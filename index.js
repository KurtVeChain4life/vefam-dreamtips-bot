import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Tables automatisch aanmaken
await pool.query(`
  CREATE TABLE IF NOT EXISTS balances (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
  CREATE TABLE IF NOT EXISTS lastdaily (key TEXT PRIMARY KEY, timestamp BIGINT);
  CREATE TABLE IF NOT EXISTS shopitems (id TEXT PRIMARY KEY, data JSONB);
  CREATE TABLE IF NOT EXISTS wallets (guildId TEXT PRIMARY KEY, seed TEXT, nextIndex INTEGER DEFAULT 0);
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT

client.once('ready', async () => {
  console.log(`${client.user.tag} → Permanent online met PostgreSQL`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder().setName('tip').setDescription('Tip iemand BOOBS').addUserOption(o => o.setName('user').setDescription('Wie').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Hoeveel').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe').addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true)).addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true)).addIntegerOption(o => o.setName('prijs').setDescription('Prijs').setRequired(true)).addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
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
    if (i.commandName === 'balance') {
      const res = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const boobs = res.rows[0]?.value || 0;
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS').addFields({ name: 'BOOBS', value: `\`${boobs}\``, inline: true })], ephemeral: true });
    }

    else if (i.commandName === 'wallet') {
      let row = await pool.query('SELECT * FROM wallets WHERE guildId = $1', [guildId]);
      let masterNode;
      if (!row.rows[0]) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        masterNode = HDNode.fromSeed(seed);
        await pool.query('INSERT INTO wallets (guildId, seed, nextIndex) VALUES ($1, $2, $3)', [guildId, Buffer.from(seed).toString('hex'), 1]);
      } else {
        masterNode = HDNode.fromSeed(Buffer.from(row.rows[0].seed, 'hex'));
        const derived = masterNode.derive(row.rows[0].nextindex);
        const address = '0x' + derived.address.toString('hex');
        await pool.query('UPDATE wallets SET nextIndex = nextIndex + 1 WHERE guildId = $1', [guildId]);
        await i.reply({ content: `**Je persoonlijke VeChain wallet**\n\`${address}\``, ephemeral: true });
        return;
      }
      const derived = masterNode.derive(0);
      const address = '0x' + derived.address.toString('hex');
      await pool.query('UPDATE wallets SET nextIndex = 1 WHERE guildId = $1', [guildId]);
      await i.reply({ content: `**Je persoonlijke VeChain wallet**\n\`${address}\``, ephemeral: true });
    }

    // (de rest van je commands – daily, tip, leaderboard, shop, addnft, buy – kunnen ook met DB, maar eerst dit werkend)

  } catch (err) {
    console.error(err);
    if (!i.replied) await i.reply({ content: 'DB error, probeer later opnieuw', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
