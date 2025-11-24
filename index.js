import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import pg from 'pg';
import { mnemonic, HDNode } from 'thor-devkit';
import { Connex } from '@vechain/connex-framework';
import { Driver, SimpleNet } from '@vechain/connex-driver';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const connex = new Connex({ node: 'https://mainnet.vechain.org/', network: 'main' });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.default.data.name, command.default);
}

client.once('ready', async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_configs (guild_id TEXT PRIMARY KEY, activity_token TEXT, reward_criteria JSONB, mint_collection TEXT);
    CREATE TABLE IF NOT EXISTS balances (key TEXT PRIMARY KEY, value JSONB DEFAULT '{}'::jsonb);
    CREATE TABLE IF NOT EXISTS lastdaily (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS wallets ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS shopitems (id TEXT PRIMARY KEY, data JSONB);
  `);

  const cmds = client.commands.map(c => c.data.toJSON());
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(cmds);
  }

  console.log(`${client.user.tag} is ready!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() && !interaction.isButton()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const key = `${message.author.id}:${message.guild.id}`;
  const guildConfig = (await pool.query('SELECT reward_criteria FROM guild_configs WHERE guild_id = $1', [message.guild.id])).rows[0]?.reward_criteria || {};

  let earned = 0;
  if (guildConfig.roles && message.member.roles.cache.some(r => guildConfig.roles.includes(r.id))) {
    earned = Math.floor(message.content.length / guildConfig.criteria.characters_per_boobs || 3); // Default 3 chars per BOOBS
    if (earned > 0) {
      await pool.query('INSERT INTO balances (key, value) VALUES ($1, value + $2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [key, earned]);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
