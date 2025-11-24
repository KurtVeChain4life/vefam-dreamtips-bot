import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OWNER_ID = 'JOUW_DISCORD_ID_HIER'; // ← VERVANG DIT ÉÉN KEER!!!

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances     (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lastdaily    (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS wallets      ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS shopitems    (id TEXT PRIMARY KEY, data JSONB);
  `);
  console.log('Database klaar');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → BOOBS IMPERIUM VOLLEDIG LIVE`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je VeChain wallet'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Tip iemand')
      .addUserOption(o => o.setName('user').setDescription('Wie').setRequired(true)),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe aan shop')
      .addStringOption(o => o.setName('titel').setDescription('Titel van de NFT').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding van de NFT').setRequired(true))
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);
    await new Promise(r => setTimeout(r, 4000));
    await guild.commands.set(commands);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isStringSelectMenu() && !i.isButton()) return;

  const userId = i.user.id;
  const guildId = i.guild?.id || 'dm';
  const key = `${userId}:${guildId}`;

  try {
    // BALANCE
    if (i.commandName === 'balance') {
      const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const boobs = rows[0]?.value || 0;
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS').addFields({ name: 'Saldo', value: `**${boobs}** Boobs`, inline: true })], ephemeral: true });
    }

    // DAILY
    else if (i.commandName === 'daily') {
      const now = Date.now();
      const { rows } = await pool.query('SELECT timestamp FROM lastdaily WHERE key = $1', [key]);
      const last = rows[0]?.timestamp || 0;
      if (now - last < 86_400_000) {
        const hrs = Math.ceil((86_400_000 - (now - last)) / 3_600_000);
        return i.reply({ content: `Nog **${hrs} uur** wachten!`, ephemeral: true });
      }
      const reward = Math.floor(Math.random() * 401) + 100;
      await pool.query('INSERT INTO balances (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [key, reward]);
      await pool.query('INSERT INTO lastdaily (key,timestamp) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET timestamp = $2', [key, now]);
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS!').setDescription(`**${reward} BOOBS** erbij!`)] });
    }

    // WALLET
    else if (i.commandName === 'wallet') {
      let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];
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
      const address = '0x' + hdNode.derive(nextIndex).address.toString('hex');
      await i.reply({ content: `**Jouw VeChain wallet**\n\`${address}\``, ephemeral: true });
    }

    // LEADERBOARD
    else if (i.commandName === 'leaderboard') {
      const { rows } = await pool.query('SELECT key, value FROM balances ORDER BY value DESC LIMIT 10');
      const lines = rows.length ? rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.value}** BOOBS`).join('\n') : 'Nog niemand...';
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    // TIP
    else if (i.commandName === 'tip') {
      const target = i.options.getUser('user');
      if (!target || target.bot || target.id === userId) return i.reply({ content: 'Ongeldige target.', ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`tip_${userId}_${target.id}`)
        .setPlaceholder('Kies wat je wil tippen...')
        .addOptions([
          { label: 'BOOBS', value: 'boobs', emoji: 'Boobs' },
          { label: 'VET (binnenkort)', value: 'vet', emoji: 'Diamond', disabled: true },
          { label: 'VTHO (binnenkort)', value: 'vtho', emoji: 'Lightning', disabled: true },
          { label: 'B3TR (binnenkort)', value: 'b3tr', emoji: 'Seedling', disabled: true }
        ]);

      await i.reply({
        content: `Wat wil je tippen aan ${target}?`,
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // TIP SELECT
    else if (i.isStringSelectMenu() && i.customId.startsWith('tip_')) {
      const [, senderId, targetId] = i.customId.split('_');
      if (senderId !== userId) return;
      if (i.values[0] !== 'boobs') {
        return i.update({ content: 'Echte tokens komen binnenkort! Voor nu alleen BOOBS.', components: [] });
      }
      const target = await i.guild.members.fetch(targetId);
      await i.update({ content: `Hoeveel BOOBS wil je tippen aan ${target}?`, components: [] });

      const collector = i.channel.createMessageCollector({ filter: m => m.author.id === userId, time: 30000, max: 1 });
      collector.on('collect', async msg => {
        const amount = parseInt(msg.content);
        if (!amount || amount <= 0) return msg.reply('Ongeldig bedrag!');
        const targetKey = `${targetId}:${guildId}`;
        const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
        if ((rows[0]?.value || 0) < amount) return msg.reply('Niet genoeg BOOBS!');
        await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [amount, key]);
        await pool.query('INSERT INTO balances (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [targetKey, amount]);
        await msg.reply(`${i.user} tipped **${amount} BOOBS** naar ${target}!`);
      });
    }

    // SHOP
    else if (i.commandName === 'shop') {
      const { rows } = await pool.query('SELECT id, data FROM shopitems');
      if (rows.length === 0) return i.reply({ content: 'Shop is leeg!', ephemeral: true });

      const embeds = [];
      const components = [];
      for (const row of rows) {
        const item = row.data;
        embeds.push(new EmbedBuilder()
          .setColor('#ff69b4')
          .setTitle(item.titel)
          .setDescription(`${item.beschrijving}\n\n**Prijs:** ${item.prijs} BOOBS`)
          .setImage(item.afbeelding));
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`buy_${row.id}`).setLabel(`Koop voor ${item.prijs}`).setStyle(ButtonStyle.Success)
        ));
      }
      await i.reply({ embeds, components });
    }

    // ADD NFT (owner only)
    else if (i.commandName === 'addnft') {
      if (userId !== OWNER_ID) return i.reply({ content: 'Alleen de owner kan dit!', ephemeral: true });
      const titel = i.options.getString('titel');
      const beschrijving = i.options.getString('beschrijving');
      const prijs = i.options.getInteger('prijs');
      const att = i.options.getAttachment('afbeelding');
      if (!att?.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

      const id = Date.now().toString();
      await pool.query('INSERT INTO shopitems (id, data) VALUES ($1, $2)', [id, {
        titel, beschrijving, prijs, afbeelding: att.url
      }]);
      await i.reply({ content: `NFT toegevoegd aan shop!\n**${titel}** — ${prijs} BOOBS`, ephemeral: true });
    }

    // BUY BUTTON
    else if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = i.customId.slice(4);
      const { rows } = await pool.query('SELECT data FROM shopitems WHERE id = $1', [id]);
      if (rows.length === 0) return i.reply({ content: 'Al verkocht!', ephemeral: true });
      const item = rows[0].data;

      const { rows: bal } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      if ((bal[0]?.value || 0) < item.prijs) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [item.prijs, key]);
      await pool.query('DELETE FROM shopitems WHERE id = $1', [id]);

      await i.reply({ content: `Je kocht **${item.titel}** voor ${item.prijs} BOOBS! Geniet ervan` });
    }

  } catch (err) {
    console.error('Fout:', err);
    if (!i.replied && !i.deferred) await i.reply({ content: 'Er ging iets mis!', ephemeral: true }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
