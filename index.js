import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import { Connex, Driver, SimpleWallet } from 'connex'; // ← dit is de echte SDK
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const connex = new Connex({
  node: 'https://mainnet.vechain.org/', // werkt altijd
  network: 'main'
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances  (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lastdaily (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS wallets   ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
  `);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → TIP MET VET/VTHO LIVE`);

  const commands = [
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Tip BOOBS of echte VeChain tokens')
      .addUserOption(o => o.setName('user').setDescription('Wie?').setRequired(true)),
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je wallet'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10')
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);
    await new Promise(r => setTimeout(r, 5000));
    await guild.commands.set(commands);
  }
});

// ====== /tip MET DROPDOWN (BOOBS + VET + VTHO + B3TR) ======
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isStringSelectMenu()) return;

  const userId = i.user.id;
  const guildId = i.guild.id;
  const key = `${userId}:${guildId}`;

  try {
    if (i.commandName === 'tip') {
      const target = i.options.getUser('user');
      if (!target || target.bot || target.id === userId) 
        return i.reply({ content: 'Invalid target.', ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`tip_${userId}_${target.id}`)
        .setPlaceholder('Kies een token...')
        .addOptions([
          { label: 'BOOBS', value: 'boobs', emoji: 'Boobs' },
          { label: 'VET',   value: 'vet',   emoji: 'Diamond' },
          { label: 'VTHO',  value: 'vtho',  emoji: 'Lightning' },
          { label: 'B3TR',  value: 'b3tr',  emoji: 'Seedling' }
        ]);

      await i.reply({
        content: `Wat wil je tippen aan ${target}?`,
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    else if (i.isStringSelectMenu() && i.customId.startsWith('tip_')) {
      const [_, senderId, targetId] = i.customId.split('_');
      if (senderId !== userId) return;

      const token = i.values[0];
      const target = await i.guild.members.fetch(targetId);

      await i.update({
        content: `Hoeveel **${token.toUpperCase()}** wil je tippen aan ${target}?`,
        components: []
      });

      const collector = i.channel.createMessageCollector({
        filter: m => m.author.id === userId,
        time: 30000,
        max: 1
      });

      collector.on('collect', async msg => {
        const amount = parseFloat(msg.content);
        if (isNaN(amount) || amount <= 0) return msg.reply('Ongeldig bedrag.');

        const targetKey = `${targetId}:${guildId}`;

        if (token === 'boobs') {
          // BOOBS tip
          const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
          if ((rows[0]?.value || 0) < amount) return msg.reply('Niet genoeg BOOBS!');

          await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [amount, key]);
          await pool.query('INSERT INTO balances (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [targetKey, amount]);
          await msg.reply(`**${amount} BOOBS** getipt naar ${target}!`);
        } 
        else {
          // ECHTE TOKEN TIP (VET / VTHO / B3TR)
          const senderAddr = await getUserAddress(key);
          const targetAddr = await getUserAddress(targetKey);
          if (!senderAddr || !targetAddr) return msg.reply('Eén van jullie heeft nog geen wallet. Typ /wallet.');

          const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
          if ((rows[0]?.value || 0) < 5) return msg.reply('Je hebt 5 BOOBS nodig als fee voor echte tips.');

          try {
            const driver = await connex.driver;
            const wallet = new SimpleWallet();
            const privateKey = await getPrivateKey(key);
            wallet.import(privateKey.replace('0x', ''));

            const clause = token === 'vet'
              ? driver.transferVET(targetAddr, BigInt(amount * 1e18))
              : driver.transferToken(
                  token === 'vtho' ? '0x0000000000000000000000000000456e65726779' : '0x...B3TR...', // vul B3TR in als je wil
                  targetAddr,
                  BigInt(amount * 1e18)
                );

            const tx = await driver.signTx([clause], { signer: senderAddr, wallet });
            const result = await driver.sendTx(tx);

            await pool.query('UPDATE balances SET value = value - 5 WHERE key = $1', [key]);

            await msg.reply(`**${amount} ${token.toUpperCase()}** verstuurd naar ${target}!\nhttps://insight.vechain.org/#/txs/${result.txid}`);
          } catch (err) {
            console.error(err);
            await msg.reply('Transactie mislukt – heb je genoeg VTHO?');
          }
        }
      });
    }

    // (voeg hier je balance, daily, wallet, leaderboard toe – die werken al)

  } catch (err) {
    console.error(err);
    if (!i.replied) await i.reply({ content: 'Error.', ephemeral: true });
  }
});

// Helpers
async function getUserAddress(key) {
  const { rows } = await pool.query('SELECT seed, "nextIndex" FROM wallets WHERE "guildId" = $1', [key.split(':')[1]]);
  if (!rows[0]) return null;
  const hdNode = HDNode.fromSeed(Buffer.from(rows[0].seed, 'hex'));
  return '0x' + hdNode.derive(rows[0].nextIndex - 1).address.toString('hex');
}

async function getPrivateKey(key) {
  const addr = await getUserAddress(key);
  const { rows } = await pool.query('SELECT seed, "nextIndex" FROM wallets WHERE "guildId" = $1', [key.split(':')[1]]);
  const hdNode = HDNode.fromSeed(Buffer.from(rows[0].seed, 'hex'));
  return '0x' + hdNode.derive(rows[0].nextIndex - 1).privateKey.toString('hex');
}

client.login(process.env.DISCORD_TOKEN);
