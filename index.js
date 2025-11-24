import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { HDNode, mnemonic } from 'thor-devkit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT MET JOUW ECHTE ID

// DB met correcte kolomnamen (geen hoofdletters in quotes!)
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      key TEXT PRIMARY KEY,
      boobs INT DEFAULT 0,
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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → BOOBS BOT 100% LIVE`);

  const cmds = [
    'balance', 'daily', 'wallet', 'leaderboard', 'shop'
  ].map(name => new SlashCommandBuilder().setName(name).setDescription(name === 'addnft' ? 'Alleen owner' : name));

  const addnft = new SlashCommandBuilder()
    .setName('addnft')
    .setDescription('Voeg NFT toe (owner only)')
    .addStringOption(o => o.setName('title').setDescription('Titel').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Omschrijving').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('Prijs in BOOBS').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Afbeelding').setRequired(true));

  await client.application.commands.set([...cmds.map(c => c.toJSON()), addnft.toJSON()]);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;
  const userKey = `${i.user.id}:${i.guildId || 'dm'}`;

  try {
    // BALANCE
    if (i.commandName === 'balance') {
      const res = await pool.query('SELECT boobs FROM users WHERE key = $1', [userKey]);
      await i.reply({ content: `Je hebt **${res.rows[0]?.boobs || 0} BOOBS**`, ephemeral: true });
    }

    // DAILY
    if (i.commandName === 'daily') {
      const now = Date.now();
      const res = await pool.query('SELECT last_daily FROM users WHERE key = $1', [userKey]);
      if (res.rows[0]?.last_daily > now - 86400000) return i.reply({ content: 'Wacht nog even!', ephemeral: true });

      const reward = Math.floor(Math.random() * 401) + 100;
      await pool.query('INSERT INTO users (key, boobs, last_daily) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET boobs = users.boobs + $2, last_daily = $3', [userKey, reward, now]);
      await i.reply(`Je kreeg **${reward} BOOBS**!`);
    }

    // WALLET — GEFIXED: mnemonic.toSeed bestaat niet meer → gebruik Buffer direct
    if (i.commandName === 'wallet') {
      const guildId = i.guildId || 'dm';
      let row = (await pool.query('SELECT * FROM wallets WHERE guild_id = $1', [guildId])).rows[0];

      if (!row) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase); // ← dit werkt weer in v2.0.9
        await pool.query('INSERT INTO wallets (guild_id, seed, next_index) VALUES ($1, $2, 1)', [guildId, seed.toString('hex')]);
        row = { seed: seed.toString('hex'), next_index: 0 };
      } else {
        await pool.query('UPDATE wallets SET next_index = next_index + 1 WHERE guild_id = $1', [guildId]);
      }

      const hd = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
      const addr = '0x' + hd.derive(row.next_index || 0).address.toString('hex');
      await i.reply({ content: `**Jouw VeChain adres**\n\`${addr}\``, ephemeral: true });
    }

    // LEADERBOARD
    if (i.commandName === 'leaderboard') {
      const res = await pool.query('SELECT key, boobs FROM users ORDER BY boobs DESC LIMIT 10');
      const lines = res.rows.length ? res.rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.boobs}** BOOBS`).join('\n') : 'Leeg';
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    // SHOP + ADDNFT + BUY
    if (i.commandName === 'shop') {
      const res = await pool.query('SELECT * FROM shop');
      if (!res.rows.length) return i.reply({ content: 'Shop is leeg!', ephemeral: true });

      const embeds = res.rows.map(r => new EmbedBuilder().setTitle(r.title).setDescription(`${r.description}\n**Prijs:** ${r.price} BOOBS`).setImage(r.image).setColor('#ff69b4'));
      const buttons = res.rows.map(r => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`buy_${r.id}`).setLabel(`Koop ${r.price}`).setStyle(ButtonStyle.Success)));
      await i.reply({ embeds, components: buttons });
    }

    if (i.commandName === 'addnft' && i.user.id === OWNER_ID) {
      const title = i.options.getString('title');
      const desc = i.options.getString('description');
      const price = i.options.getInteger('price');
      const img = i.options.getAttachment('image').url;
      await pool.query('INSERT INTO shop (title, description, price, image) VALUES ($1,$2,$3,$4)', [title, desc, price, img]);
      await i.reply({ content: 'NFT toegevoegd!', ephemeral: true });
    }

    if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = i.customId.split('_')[1];
      const item = (await pool.query('SELECT * FROM shop WHERE id = $1', [id])).rows[0];
      if (!item) return i.reply({ content: 'Al verkocht!' });

      const user = (await pool.query('SELECT boobs FROM users WHERE key = $1', [userKey])).rows[0];
      if (!user || user.boobs < item.price) return i.reply({ content: 'Niet genoeg BOOBS!' });

      await pool.query('UPDATE users SET boobs = boobs - $1 WHERE key = $2', [item.price, userKey]);
      await pool.query('DELETE FROM shop WHERE id = $1', [id]);
      await i.reply(`Je kocht **${item.title}** voor ${item.price} BOOBS!`);
    }

  } catch (e) {
    console.error(e);
    if (!i.replied) await i.reply({ content: 'Iets ging fout.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
