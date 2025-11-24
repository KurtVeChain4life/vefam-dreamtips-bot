import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT MET JOUW ECHTE ID!!!

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      key TEXT PRIMARY KEY,
      boobs BIGINT DEFAULT 0,
      last_daily BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS wallets (
      guild_id TEXT PRIMARY KEY,
      seed TEXT,
      next_index INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS shop (
      id SERIAL PRIMARY KEY,
      title TEXT,
      description TEXT,
      price INT,
      image TEXT
    );
  `);
  console.log('DB klaar');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → BOOBS BOT 100% LIVE`);

  const cmds = [
    new SlashCommandBuilder().setName('balance').setDescription('Hoeveel BOOBS heb je?'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je eigen VeChain adres'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS kings'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe')
      .addStringOption(o => o.setName('title').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Omschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Prijs in BOOBS').setRequired(true))
      .addAttachmentOption(o => o.setName('image').setDescription('Afbeelding').setRequired(true))
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(cmds);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const userKey = `${i.user.id}:${i.guildId}`;
  try {
    if (i.commandName === 'balance') {
      const res = await pool.query('SELECT boobs FROM users WHERE key = $1', [userKey]);
      const boobs = res.rows[0]?.boobs || 0;
      await i.reply({ content: `Je hebt **${boobs} BOOBS**!`, ephemeral: true });
    }

    if (i.commandName === 'daily') {
      const now = Date.now();
      const res = await pool.query('SELECT last_daily FROM users WHERE key = $1', [userKey]);
      const last = res.rows[0]?.last_daily || 0;

      if (now - last < 86400000) {
        return i.reply({ content: 'Je hebt vandaag al geclaimd!', ephemeral: true });
      }

      const reward = Math.floor(Math.random() * 401) + 100;
      await pool.query('INSERT INTO users (key, boobs, last_daily) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET boobs = users.boobs + $2, last_daily = $3', [userKey, reward, now]);

      await i.reply(`Je kreeg **${reward} BOOBS**!`);
    }

    if (i.commandName === 'wallet') {
      const guildId = i.guildId;
      let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];

      if (!row) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        const hd = HDNode.fromSeed(seed);
        row = { seed: seed.toString('hex'), next_index: 0 };
        await pool.query('INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)', [guildId, row.seed]);
      } else {
        await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
      }

      const hd = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
      const addr = '0x' + hd.derive(row.next_index || 0).address.toString('hex');
      await i.reply({ content: `**Jouw VeChain adres**\n\`${addr}\``, ephemeral: true });
    }

    if (i.commandName === 'leaderboard') {
      const res = await pool.query('SELECT key, boobs FROM users ORDER BY boobs DESC LIMIT 10');
      const lines = res.rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.boobs}** BOOBS`).join('\n') || 'Nog niemand...';
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    if (i.commandName === 'shop') {
      const res = await pool.query('SELECT * FROM shop ORDER BY id');
      if (res.rows.length === 0) return i.reply({ content: 'Shop is leeg!', ephemeral: true });

      const embeds = res.rows.map(item => new EmbedBuilder()
        .setTitle(item.title)
        .setDescription(`${item.description}\n\n**Prijs:** ${item.price} BOOBS`)
        .setImage(item.image)
        .setColor('#ff69b4')
      );
      const buttons = res.rows.map(item => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`buy_${item.id}`).setLabel(`Koop – ${item.price} BOOBS`).setStyle(ButtonStyle.Success)
      ));

      await i.reply({ embeds, components: buttons });
    }

    if (i.commandName === 'addnft') {
      if (i.user.id !== OWNER_ID) return i.reply({ content: 'Alleen de owner!', ephemeral: true });
      const title = i.options.getString('title');
      const desc = i.options.getString('description');
      const price = i.options.getInteger('price');
      const img = i.options.getAttachment('image').url;

      await pool.query('INSERT INTO shop (title, description, price, image) VALUES ($1, $2, $3, $4)', [title, desc, price, img]);
      await i.reply({ content: 'NFT toegevoegd aan de shop!', ephemeral: true });
    }

    if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = parseInt(i.customId.split('_')[1]);
      const itemRes = await pool.query('SELECT * FROM shop WHERE id = $1', [id]);
      if (itemRes.rows.length === 0) return i.reply({ content: 'Al verkocht!', ephemeral: true });
      const item = itemRes.rows[0];

      const userRes = await pool.query('SELECT boobs FROM users WHERE key = $1', [userKey]);
      const boobs = userRes.rows[0]?.boobs || 0;
      if (boobs < item.price) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      await pool.query('UPDATE users SET boobs = boobs - $1 WHERE key = $2', [item.price, userKey]);
      await pool.query('DELETE FROM shop WHERE id = $1', [id]);

      await i.reply(`Je kocht **${item.title}** voor ${item.price} BOOBS!`);
    }

  } catch (e) {
    console.error(e);
    if (!i.replied) await i.reply({ content: 'Er ging iets mis.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
