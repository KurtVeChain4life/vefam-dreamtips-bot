import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import { Connex } from '@vechain/connex';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const connex = new Connex({
  node: 'https://node-mainnet.vechain.org',
  network: 'main'
});

// Token lijst – makkelijk uitbreiden
const TOKENS = {
  boobs: { name: 'BOOBS', color: '#ff69b4', internal: true },
  vet:   { name: 'VET',   color: '#00d4ff', internal: false, contract: null },
  vtho:  { name: 'VTHO',  color: '#ffaa00', internal: false, contract: '0x0000000000000000000000000000456e65726779' },
  b3tr:  { name: 'B3TR',  color: '#00ff9d', internal: false, contract: '0x...B3TR_CONTRACT...' } // ← vul in als je wil
};

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances     (key TEXT PRIMARY KEY, value BIGINT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lastdaily    (key TEXT PRIMARY KEY, timestamp BIGINT);
    CREATE TABLE IF NOT EXISTS wallets      ("guildId" TEXT PRIMARY KEY, seed TEXT, "nextIndex" INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS tiplog       (id SERIAL PRIMARY KEY, fromUser TEXT, toUser TEXT, token TEXT, amount NUMERIC, txHash TEXT, timestamp BIGINT);
  `);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT

client.once('ready', async () => {
  await initDB();
  console.log(`${client.user.tag} → BOOBS + ECHTE VECHAIN TIPS LIVE`);

  const commands = [
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Tip iemand BOOBS of echte VeChain tokens')
      .addUserOption(o => o.setName('user').setDescription('Wie wil je tippen?').setRequired(true)),
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings')
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);
    await new Promise(r => setTimeout(r, 5000));
    await guild.commands.set(commands);
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isStringSelectMenu()) return;

  const userId = i.user.id;
  const guildId = i.guild?.id || 'dm';
  const key = `${userId}:${guildId}`;

  try {
    if (i.commandName === 'tip') {
      const target = i.options.getUser('user');
      if (!target || target.bot || target.id === userId) return i.reply({ content: 'Nice try', ephemeral: true });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`tip_token_${target.id}`)
        .setPlaceholder('Kies wat je wil tippen...')
        .addOptions(
          { label: 'BOOBS (intern)', value: 'boobs', description: 'Je eigen server token', emoji: '🍒' },
          { label: 'VET', value: 'vet', description: 'VeChain native token', emoji: '💎' },
          { label: 'VTHO', value: 'vtho', description: 'VeChain energy', emoji: '⚡' },
          { label: 'B3TR', value: 'b3tr', description: 'VeBetterDAO token', emoji: '🌱' }
        );

      await i.reply({
        content: `Wat wil je tippen aan ${target}?`,
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    else if (i.isStringSelectMenu() && i.customId.startsWith('tip_token_')) {
      const targetId = i.customId.split('_')[2];
      const target = await i.guild.members.fetch(targetId);
      const tokenKey = i.values[0];
      const token = TOKENS[tokenKey];

      await i.update({
        content: `Hoeveel **${token.name}** wil je tippen aan ${target}?`,
        components: [],
        embeds: [new EmbedBuilder().setColor(token.color).setTitle(`Tip ${token.name}`)]
      });

      const filter = m => m.author.id === i.user.id;
      const collector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async msg => {
        const amount = parseFloat(msg.content);
        if (isNaN(amount) || amount <= 0) return msg.reply('Ongeldig bedrag.');

        const targetKey = `${targetId}:${guildId}`;

        if (token.internal) {
          // Interne BOOBS tip
          const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
          if ((rows[0]?.value || 0) < amount) return msg.reply('Niet genoeg BOOBS!');

          await pool.query('UPDATE balances SET value = value - $1 WHERE key = $2', [amount, key]);
          await pool.query('INSERT INTO balances (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [targetKey, amount]);
          await pool.query('INSERT INTO tiplog (fromUser, toUser, token, amount, timestamp) VALUES ($1,$2,$3,$4,$5)', [userId, targetId, 'BOOBS', amount, Date.now()]);

          await msg.reply(`✅ **${amount} BOOBS** getipt naar ${target}!`);
        } else {
          // Echte token tip
          const senderAddr = await getUserAddress(key);
          const targetAddr = await getUserAddress(targetKey);
          if (!senderAddr || !targetAddr) return msg.reply('Eén van jullie heeft nog geen wallet. Typ /wallet eerst.');

          // Check BOOBS fee (bijv. 5 BOOBS per echte tip)
          const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
          if ((rows[0]?.value || 0) < 5) return msg.reply('Je hebt minimaal 5 BOOBS nodig voor een echte tip.');

          try {
            const clause = token.contract
              ? connex.thor.account(token.contract).method({ name: 'transfer', inputs: [{ type: 'address' }, { type: 'uint256' }] }).asClause(targetAddr, BigInt(amount * 1e18))
              : connex.thor.account(senderAddr).transfer(targetAddr, BigInt(amount * 1e18));

            const signingService = connex.vendor.sign('tx').signer(senderAddr);
            const privateKey = await getPrivateKey(key);
            const signed = await signingService.request([{ ...clause, value: '0x0' }], { signer: privateKey });
            const receipt = await connex.thor.transaction(signed.id).getReceipt();

            if (receipt?.reverted) throw new Error('Tx reverted');

            // Trek fee af
            await pool.query('UPDATE balances SET value = value - 5 WHERE key = $1', [key]);
            await pool.query('INSERT INTO tiplog (fromUser, toUser, token, amount, txHash, timestamp) VALUES ($1,$2,$3,$4,$5,$6)', [userId, targetId, token.name, amount, signed.id, Date.now()]);

            await msg.reply(`✅ **${amount} ${token.name}** succesvol verstuurd naar ${target}!\nTx: https://insight.vechain.org/#/txs/${signed.id}`);
          } catch (err) {
            console.error(err);
            await msg.reply('Transactie mislukt. Zorg dat je genoeg VTHO hebt.');
          }
        }
      });
    }

    // (voeg hier je balance, daily, wallet, leaderboard toe – die heb je al werkend)

  } catch (err) {
    console.error('Fout:', err);
    if (!i.replied) await i.reply({ content: 'Er ging iets mis', ephemeral: true });
  }
});

// Helper functies (voeg onderaan toe)
async function getUserAddress(key) {
  const guildId = key.split(':')[1];
  const { rows } = await pool.query('SELECT seed, "nextIndex" FROM wallets WHERE "guildId" = $1', [guildId]);
  if (!rows[0]) return null;
  const hdNode = HDNode.fromSeed(Buffer.from(rows[0].seed, 'hex'));
  return '0x' + hdNode.derive(rows[0].nextIndex - 1).address.toString('hex');
}

async function getPrivateKey(key) {
  const address = await getUserAddress(key);
  const guildId = key.split(':')[1];
  const { rows } = await pool.query('SELECT seed FROM wallets WHERE "guildId" = $1', [guildId]);
  const hdNode = HDNode.fromSeed(Buffer.from(rows[0].seed, 'hex'));
  const index = (await pool.query('SELECT "nextIndex" FROM wallets WHERE "guildId" = $1', [guildId])).rows[0].nextIndex - 1;
  return '0x' + hdNode.derive(index).privateKey.toString('hex');
}

client.login(process.env.DISCORD_TOKEN);
