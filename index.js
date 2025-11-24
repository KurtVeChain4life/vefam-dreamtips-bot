import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OWNER_ID = '495648570968637452'; // ← VERVANG ALLEEN DIT MET JOUW ECHTE ID

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (key TEXT PRIMARY KEY, boobs BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lastdaily (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS wallets ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS shopitems (id TEXT PRIMARY KEY, data JSONB);
  `);
  console.log('DB ready');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → BOOBS BOT 100% LIVE & GROEN`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS kings'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe')
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
  ].map(c => c.toJSON());

  await client.application.commands.set(commands);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  const userKey = `${interaction.user.id}:${interaction.guildId || 'dm'}`;

  try {
    if (interaction.commandName === 'balance') {
      const { rows } = await pool.query('SELECT boobs FROM balances WHERE key = $1', [userKey]);
      const boobs = rows[0]?.boobs || 0;
      await interaction.reply({ content: `Je hebt **${boobs} BOOBS**`, ephemeral: true });
    }

    if (interaction.commandName === 'daily') {
      const now = Date.now();
      const { rows } = await pool.query('SELECT timestamp FROM lastdaily WHERE key = $1', [userKey]);
      const last = rows[0]?.timestamp || 0;
      if (now - last < 86400000) return interaction.reply({ content: 'Je hebt vandaag al geclaimd!', ephemeral: true });

      const reward = Math.floor(Math.random() * 401) + 100;
      await pool.query('INSERT INTO balances (key, boobs) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET boobs = balances.boobs + $2', [userKey, reward]);
      await pool.query('INSERT INTO lastdaily (key, timestamp) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamp = $2', [userKey, now]);
      await interaction.reply(`Je kreeg **${reward} BOOBS**!`);
    }

    if (interaction.commandName === 'wallet') {
      const guildId = interaction.guildId || 'dm';
      let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];

      if (!row) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        await pool.query('INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)', [guildId, Buffer.from(seed).toString('hex')]);
        row = { seed: Buffer.from(seed).toString('hex'), nextIndex: 0 };
      } else {
        await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
      }

      const hd = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
      const address = '0x' + hd.derive(row.nextIndex || 0).address.toString('hex');
      await interaction.reply({ content: `**Jouw VeChain wallet**\n\`${address}\``, ephemeral: true });
    }

    if (interaction.commandName === 'leaderboard') {
      const { rows } = await pool.query('SELECT key, boobs FROM balances ORDER BY boobs DESC LIMIT 10');
      const lines = rows.length ? rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.boobs}** BOOBS`).join('\n') : 'Nog niemand...';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    if (interaction.commandName === 'shop') {
      const { rows } = await pool.query('SELECT id, data FROM shopitems');
      if (rows.length === 0) return interaction.reply({ content: 'Shop is leeg!', ephemeral: true });

      const embeds = rows.map(r => new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle(r.data.titel)
        .setDescription(`${r.data.beschrijving}\n\n**Prijs:** ${r.data.prijs} BOOBS`)
        .setImage(r.data.afbeelding)
      );
      const components = rows.map(r => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`buy_${r.id}`).setLabel(`Koop – ${r.data.prijs}`).setStyle(ButtonStyle.Success)
      ));

      await interaction.reply({ embeds, components });
    }

    if (interaction.commandName === 'addnft') {
      if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Alleen de owner!', ephemeral: true });
      const titel = interaction.options.getString('titel');
      const beschrijving = interaction.options.getString('beschrijving');
      const prijs = interaction.options.getInteger('prijs');
      const img = interaction.options.getAttachment('afbeelding');
      if (!img?.contentType?.startsWith('image/')) return interaction.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

      const id = Date.now().toString();
      await pool.query('INSERT INTO shopitems (id, data) VALUES ($1, $2)', [id, { titel, beschrijving, prijs, afbeelding: img.url }]);
      await interaction.reply({ content: `NFT toegevoegd! **${titel}** – ${prijs} BOOBS`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
      const id = interaction.customId.slice(4);
      const { rows } = await pool.query('SELECT data FROM shopitems WHERE id = $1', [id]);
      if (rows.length === 0) return interaction.reply({ content: 'Al verkocht!', ephemeral: true });
      const item = rows[0].data;

      const { rows: bal } = await pool.query('SELECT boobs FROM balances WHERE key = $1', [userKey]);
      const boobs = bal[0]?.boobs || 0;
      if (boobs < item.prijs) return interaction.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      await pool.query('UPDATE balances SET boobs = boobs - $1 WHERE key = $2', [item.prijs, userKey]);
      await pool.query('DELETE FROM shopitems WHERE id = $1', [id]);
      await interaction.reply(`Je kocht **${item.titel}** voor ${item.prijs} BOOBS!`);
    }

  } catch (err) {
    console.error('Error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Er ging iets mis!', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
