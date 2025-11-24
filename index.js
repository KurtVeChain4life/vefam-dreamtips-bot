import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import 'dotenv/config';

// PostgreSQL pool – met extra Railway-vriendelijke opties
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// === Commands laden ===
const commandsPath = join(process.cwd(), 'commands');
const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if ('data' in command.default && 'execute' in command.default) {
    client.commands.set(command.default.data.name, command.default);
  }
}

// === DB + BOT STARTUP (DIT IS DE MAGIE) ===
async function initializeBot() {
  console.log('Bot aan het opstarten... wacht op PostgreSQL');

  let connected = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 × 2 sec = 60 seconden wachten (Railway heeft dit nodig)

  while (!connected && attempts < maxAttempts) {
    attempts++;
    try {
      await pool.query('SELECT 1');
      connected = true;
      console.log(`PostgreSQL verbonden na ${attempts} poging(en)`);
    } catch (err) {
      console.log(`DB nog niet klaar... wachten (poging ${attempts}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, 2000)); // 2 seconden wachten
    }
  }

  if (!connected) {
    console.error('Kon na 60 seconden geen verbinding maken met PostgreSQL');
    process.exit(1);
  }

  // Nu pas tabellen forceren
  await pool.query(`
    DROP TABLE IF EXISTS balances, lastdaily, wallets, shopitems CASCADE;

    CREATE TABLE balances (key TEXT PRIMARY KEY, boobs BIGINT DEFAULT 0);
    CREATE TABLE lastdaily (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE wallets ("guildId" TEXT PRIMARY KEY, seed TEXT NOT NULL, "nextIndex" INTEGER DEFAULT 0);
    CREATE TABLE shopitems (id TEXT PRIMARY KEY, data JSONB NOT NULL);
  `);
  console.log('Tabellen geforceerd opnieuw aangemaakt – 100% schoon');

  // Commands registeren
  const commands = [...client.commands.values()].map(c => c.data.toJSON());
  await client.application.commands.set(commands);
  console.log(`${commands.length} commands geregistreerd – BOT KLAAR VOOR ACTIE`);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} – BOOBS IMPERIUM LIVE`);
  await initializeBot();
});

// === Interactions ===
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction, pool);
    }

    if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
      const shop = client.commands.get('shop');
      if (shop?.handleBuy) await shop.handleBuy(interaction, pool);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Er ging iets mis!', ephemeral: true }).catch(() => {});
    }
  }
});

// === Foutafhandeling ===
client.on('error', console.error);
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));

client.login(process.env.DISCORD_TOKEN);
