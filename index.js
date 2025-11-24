import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import 'dotenv/config';

// PostgreSQL pool
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
    // Voor knoppen (shop buy)
    if (command.default.handleBuy) {
      client.commands.set('shop', command.default);
    }
  }
}

// ==== BELANGRIJKSTE FIX: ROBUUSTE DB INITIALISATIE ====
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} – BOOBS IMPERIUM LIVE`);

  let connected = false;
  let retries = 10;

  while (!connected && retries > 0) {
    try {
      // Test of DB bereikbaar is
      await pool.query('SELECT 1');
      console.log('PostgreSQL verbonden');

      // Forceer schone tabellen (altijd werken na reset)
      await pool.query(`
        DROP TABLE IF EXISTS balances, lastdaily, wallets, shopitems CASCADE;

        CREATE TABLE balances (
          key TEXT PRIMARY KEY,
          boobs BIGINT DEFAULT 0
        );
        CREATE TABLE lastdaily (
          key TEXT PRIMARY KEY,
          timestamp BIGINT
        );
        CREATE TABLE wallets (
          "guildId" TEXT PRIMARY KEY,
          seed TEXT NOT NULL,
          "nextIndex" INTEGER DEFAULT 0
        );
        CREATE TABLE shopitems (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL
        );
      `);
      console.log('Alle tabellen geforceerd opnieuw aangemaakt – 100% schoon');
      connected = true;
    } catch (err) {
      retries--;
      console.log(`DB niet klaar... nog ${retries} seconden wachten...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sec wachten
    }
  }

  if (!connected) {
    console.error('Kon geen verbinding maken met PostgreSQL na 10 pogingen');
    process.exit(1);
  }

  // Register commands globaal
  try {
    const commands = [...client.commands.values()].map(cmd => cmd.data.toJSON());
    await client.application.commands.set(commands);
    console.log(`${commands.length} commands succesvol geregistreerd`);
  } catch (err) {
    console.error('Fout bij registeren commands:', err);
  }
});

// ==== INTERACTIONS ====
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      await command.execute(interaction, pool);
    }

    if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
      const shopCommand = client.commands.get('shop');
      if (shopCommand?.handleBuy) {
        await shopCommand.handleBuy(interaction, pool);
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ 
        content: 'Er ging iets mis bij het uitvoeren van je command!', 
        ephemeral: true 
      }).catch(() => {});
    }
  }
});

// ==== ERROR HANDLING ====
client.on('error', console.error);
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN);
