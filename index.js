import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OWNER_ID = '495648570968637452'; // Replace with your actual Discord ID

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lastdaily (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS points (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS wallets ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS shopitems (id TEXT PRIMARY KEY, data JSONB);
  `);
  console.log('Database initialized');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} - Bot ready`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('View your BOOBS balance'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your daily BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Get your VeChain wallet'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS holders'),
    new SlashCommandBuilder().setName('shop').setDescription('View the NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('Add NFT to shop (owner only)')
      .addStringOption(option => option.setName('titel').setDescription('Title').setRequired(true))
      .addStringOption(option => option.setName('beschrijving').setDescription('Description').setRequired(true))
      .addIntegerOption(option => option.setName('prijs').setDescription('Price in BOOBS').setRequired(true))
      .addAttachmentOption(option => option.setName('afbeelding').setDescription('Image').setRequired(true)),
    new SlashCommandBuilder().setName('tip').setDescription('Tip someone')
      .addUserOption(option => option.setName('user').setDescription('Who to tip').setRequired(true))
  ].map(command => command.toJSON());

  await client.application.commands.set(commands);
  console.log('Commands registered');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) return;

  const key = `${interaction.user.id}:${interaction.guildId || 'dm'}`;

  try {
    if (interaction.commandName === 'balance') {
      const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const boobs = rows[0]?.value || 0;
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Your Balance').setDescription(`**${boobs} BOOBS**`)], ephemeral: true });
    }

    else if (interaction.commandName === 'daily') {
      const now = Date.now();
      const { rows } = await pool.query('SELECT timestamp FROM lastdaily WHERE key = $1', [key]);
      const last = rows[0]?.timestamp || 0;
      if (now - last < 86400000) return interaction.reply({ content: 'You already claimed today!', ephemeral: true });

      const reward = Math.floor(Math.random() * 401) + 100;
      await pool.query('INSERT INTO balances (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [key, reward]);
      await pool.query('INSERT INTO lastdaily (key, timestamp) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamp = $2', [key, now]);
      await interaction.reply(`You got **${reward} BOOBS**!`);
    }

    else if (interaction.commandName === 'wallet') {
      let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [interaction.guildId])).rows[0];
      let hdNode, nextIndex = 0;

      if (!row) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        hdNode = HDNode.fromSeed(seed);
        await pool.query('INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)', [interaction.guildId, Buffer.from(seed).toString('hex')]);
      } else {
        hdNode = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
        nextIndex = row.nextIndex || 0;
        await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [interaction.guildId]);
      }

      const derived = hdNode.derive(nextIndex);
      const address = '0x' + derived.address.toString('hex');
      await interaction.reply({ content: `**Your VeChain wallet**\n\`${address}\``, ephemeral: true });
    }

    else if (interaction.commandName === 'leaderboard') {
      const { rows } = await pool.query('SELECT key, value FROM balances ORDER BY value DESC LIMIT 10');
      const lines = rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.value}** BOOBS`).join('\n') || 'No one yet...';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    else if (i.commandName === 'shop') {
      const { rows } = await pool.query('SELECT * FROM shopitems');
      if (rows.length === 0) return i.reply({ content: 'Shop is leeg!', ephemeral: true });

      const embeds = [];
      const components = [];
      for (const row of rows) {
        const item = row.data;
        embeds.push(new EmbedBuilder().setColor('#ff69b4').setTitle(item.titel).setDescription(`${item.beschrijving}\n**Prijs:** ${item.prijs} BOOBS`).setImage(item.afbeelding));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`buy_${row.id}`).setLabel(`Koop voor ${item.prijs}`).setStyle(ButtonStyle.Success)));
      }
      await i.reply({ embeds, components });
    }

    else if (i.commandName === 'addnft') {
      if (i.user.id !== OWNER_ID) return i.reply({ content: 'Alleen de owner!', ephemeral: true });
      const titel = i.options.getString('titel');
      const beschrijving = i.options.getString('beschrijving');
      const prijs = i.options.getInteger('prijs');
      const att = i.options.getAttachment('afbeelding');
      if (!att?.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

      const id = Date.now().toString();
      await pool.query('INSERT INTO shopitems (id, data) VALUES ($1, $2)', [id, { titel, beschrijving, prijs, afbeelding: att.url }]);
      await i.reply({ content: `NFT toegevoegd! **${titel}** — ${prijs} BOOBS`, ephemeral: true });
    }

    else if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = i.customId.slice(4);
      const { rows } = await pool.query('SELECT data FROM shopitems WHERE id = $1', [id]);
      if (rows.length === 0) return i.reply({ content: 'Al verkocht!', ephemeral: true });
      const item = rows[0].data;

      const { rows: bal } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
      const boobs = bal[0]?.value || 0;
      if (boobs < item.prijs) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [item.prijs, key]);
      await pool.query('DELETE FROM shopitems WHERE id = $1', [id]);

      await i.reply({ content: `Je kocht **${item.titel}** voor ${item.prijs} BOOBS!` });
    }

  } catch (err) {
    console.error('Fout:', err);
    if (!i.replied) await i.reply({ content: 'Er ging iets mis!', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
