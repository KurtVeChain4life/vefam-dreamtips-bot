import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances     (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lastdaily    (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS shopitems    (id TEXT PRIMARY KEY, data JSONB);
    CREATE TABLE IF NOT EXISTS wallets      ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
  `);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT NOG ÉÉN KEER!!!

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → ALLES WERKT & PERMANENT LIVE`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'),
    new SlashCommandBuilder().setName('tip').setDescription('Tip iemand BOOBS')
      .addUserOption(o => o.setName('user').setDescription('Wie').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe')
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);
    await new Promise(r => setTimeout(r, 5000));
    await guild.commands.set(commands);
    console.log(`✔ ${guild.name} → commands schoon`);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const userId = i.user.id;
  const guildId = i.guild?.id || 'dm';
  const key = `${userId}:${guildId}`;

  try {
    // BALANCE
    if (i.commandName === 'balance') {
      const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const boobs = rows[0]?.value || 0;
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS').addFields({ name: 'BOOBS', value: `\`${boobs}\``, inline: true })], ephemeral: true });
    }

    // DAILY
    else if (i.commandName === 'daily') {
      const now = Date.now();
      const { rows } = await pool.query('SELECT timestamp FROM lastdaily WHERE key = $1', [key]);
      const last = rows[0]?.timestamp || 0;
      if (now - last < 86_400_000) {
        const hrs = Math.ceil((86_400_000 - (now - last)) / 3_600_000);
        return i.reply({ content: `Nog ${hrs} uur wachten`, ephemeral: true });
      }
      const reward = Math.floor(Math.random() * 401) + 100;
      await pool.query('INSERT INTO balances (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [key, reward]);
      await pool.query('INSERT INTO lastdaily (key,timestamp) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET timestamp = $2', [key, now]);
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS!').setDescription(`**${reward} BOOBS** erbij!`)] });
    }

    // WALLET
    else if (i.commandName === 'wallet') {
      const { rows } = await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId]);
      let row = rows[0];
      let hdNode, nextIndex = 0;

      if (!row) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        hdNode = HDNode.fromSeed(seed);
        await pool.query('INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1,$2,$3)', [guildId, Buffer.from(seed).toString('hex'), 1]);
      } else {
        hdNode = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
        nextIndex = row.nextIndex || 0;
        await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
      }
      const derived = hdNode.derive(nextIndex);
      const address = '0x' + derived.address.toString('hex');
      await i.reply({ content: `**Je persoonlijke VeChain wallet**\n\`${address}\``, ephemeral: true });
    }

    // TIP
    else if (i.commandName === 'tip') {
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('amount');
      if (!target || target.bot || target.id === userId) return i.reply({ content: 'Nice try', ephemeral: true });

      const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const bal = rows[0]?.value || 0;
      if (bal < amount) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      const targetKey = `${target.id}:${guildId}`;
      await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [amount, key]);
      await pool.query('INSERT INTO balances (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [targetKey, amount]);
      await i.reply(`**${i.user} tipped ${amount} BOOBS naar ${target}!**`);
    }

    // LEADERBOARD
    else if (i.commandName === 'leaderboard') {
      const { rows } = await pool.query('SELECT key, value FROM balances ORDER BY value DESC LIMIT 10');
      const lines = rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> — **${r.value} BOOBS**`).join('\n') || 'Nog niemand';
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    // SHOP
    else if (i.commandName === 'shop') {
      const { rows } = await pool.query('SELECT id, data FROM shopitems');
      if (rows.length === 0) return i.reply({ content: 'Shop is leeg!', ephemeral: true });

      const embeds = [];
      const components = [];
      for (const row of rows) {
        const item = row.data;
        embeds.push(new EmbedBuilder().setColor('#ff69b4').setTitle(item.title).setDescription(`${item.desc}\n\n**Prijs:** ${item.price} BOOBS`).setImage(item.imageUrl));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`buy_${row.id}`).setLabel(`Koop voor ${item.price}`).setStyle(ButtonStyle.Success)));
      }
      await i.reply({ embeds, components });
    }

    // ADDNFT (owner only)
    else if (i.commandName === 'addnft') {
      if (userId !== OWNER_ID) return i.reply({ content: 'Alleen de owner!', ephemeral: true });
      const title = i.options.getString('titel');
      const desc = i.options.getString('beschrijving');
      const price = i.options.getInteger('prijs');
      const att = i.options.getAttachment('afbeelding');
      if (!att?.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

      const id = Date.now().toString();
      await pool.query('INSERT INTO shopitems (id, data) VALUES ($1, $2)', [id, { title, desc, price, imageUrl: att.url }]);
      await i.reply({ content: `NFT toegevoegd! **${title}** — ${price} BOOBS`, ephemeral: true });
    }

    // BUY BUTTON
    else if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = i.customId.slice(4);
      const { rows } = await pool.query('SELECT data FROM shopitems WHERE id = $1', [id]);
      if (rows.length === 0) return i.reply({ content: 'Al verkocht!', ephemeral: true });
      const item = rows[0].data;

      const { rows: balRows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const bal = balRows[0]?.value || 0;
      if (bal < item.price) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [item.price, key]);
      await pool.query('DELETE FROM shopitems WHERE id = $1', [id]);
      await i.reply({ content: `Je kocht **${item.title}** voor ${item.price} BOOBS!` });
    }

  } catch (err) {
    console.error('Fout:', err);
    if (!i.replied && !i.deferred) await i.reply({ content: 'Er ging iets mis', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
