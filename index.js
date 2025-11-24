import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
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

// Laad alle commands
const commandsPath = join(process.cwd(), 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if ('data' in command.default && 'execute' in command.default) {
    client.commands.set(command.default.data.name, command.default);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} – BOOBS IMPERIUM LIVE`);

  // DB tabellen aanmaken
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      key TEXT PRIMARY KEY,
      boobs BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lastdaily (
      key TEXT PRIMARY KEY,
      timestamp BIGINT
    );
    CREATE TABLE IF NOT EXISTS wallets (
      "guildId" TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      "nextIndex" INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS shopitems (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `);

  // Register commands globaal
  const commands = [...client.commands.values()].map(cmd => cmd.data.toJSON());
  await client.application.commands.set(commands);
  console.log(`${commands.length} commands geregistreerd`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, pool);
    } catch (error) {
      console.error(error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Er ging iets mis!', ephemeral: true });
      }
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
    const command = client.commands.get('shop');
    if (command?.handleBuy) {
      await command.handleBuy(interaction, pool);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
