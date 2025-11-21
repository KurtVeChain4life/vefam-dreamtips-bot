import { Client, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// In-memory storage
const wallets   = new Map(); // guildId → { masterNode, nextIndex }
const balances  = new Map(); // userId:guildId → BOOBS
const points    = new Map(); // userId:guildId → punten
const lastDaily = new Map(); // userId:guildId → timestamp

client.once('ready', async () => {
  console.log(`VeChain Dreamtips & More online als ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Tip iemand BOOBS')
      .addUserOption(o => o.setName('user').setDescription('Wie wil je tippen?').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel BOOBS?').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS (100–500)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 rijkste leden (BOOBS)'),
    new SlashCommandBuilder().setName('wallet').setDescription('Bekijk je VeChain wallet adres')
  ].map(c => c.toJSON());

  await client.application.commands.set(commands);
  console.log('Slash commands geregistreerd!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const key = `${userId}:${guildId}`;

  if (commandName === 'balance') {
    const boobs = balances.get(key) || 0;
    const pts   = points.get(key)   || 0;
    await interaction.reply({ content: `**Jouw stats**\nBOOBS: \`${boobs}\`\nPunten: \`${pts}\``, ephemeral: true });
  }

  if (commandName === 'tip') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.bot) return interaction.reply({ content: 'Je kunt geen bots tippen!', ephemeral: true });
    if (target.id === userId) return interaction.reply({ content: 'Je kunt niet naar jezelf tippen!', ephemeral: true });

    const senderBoobs = balances.get(key) || 0;
    if (senderBoobs < amount) return interaction.reply({ content: `Je hebt maar ${senderBoobs} BOOBS!`, ephemeral: true });

    const targetKey = `${target.id}:${guildId}`;
    balances.set(key, senderBoobs - amount);
    balances.set(targetKey, (balances.get(targetKey) || 0) + amount);

    await interaction.reply(`**${interaction.user} heeft ${amount} BOOBS getipt naar ${target}!**`);
  }

  if (commandName === 'daily') {
    const now = Date.now();
    const last = lastDaily.get(key) || 0;
    if (now - last < 86400000) {
      const remaining = Math.ceil((86400000 - (now - last)) / 3600000);
      return interaction.reply({ content: `Wacht nog ${remaining} uur voor je volgende daily!`, ephemeral: true });
    }

    const reward = Math.floor(Math.random() * 401) + 100; // 100–500 BOOBS
    balances.set(key, (balances.get(key) || 0) + reward);
    lastDaily.set(key, now);

    await interaction.reply(`**Daily geclaimed!** Je krijgt **${reward} BOOBS**!`);
  }

  if (commandName === 'wallet') {
    let data = wallets.get(guildId);
    if (!data) {
      const phrase = mnemonic.generate();
      const seed = mnemonic.toSeed(phrase);
      data = { masterNode: HDNode.fromSeed(seed), nextIndex: 0 };
      wallets.set(guildId, data);
    }
    const wallet = data.masterNode.derive(data.nextIndex);
    const address = '0x' + wallet.address.toString('hex');
    await interaction.reply({ content: `**Je VeChain wallet**\n\`${address}\``, ephemeral: true });
  }

  if (commandName === 'leaderboard') {
    const entries = [];
    for (const [k, boobs] of balances) {
      const [uid] = k.split(':');
      entries.push({ userId: uid, boobs });
    }
    entries.sort((a, b) => b.boobs - a.boobs);
    const top = entries.slice(0, 10);

    const lines = top.length 
      ? top.map((e, i) => `${i+1}. <@${e.userId}> — ${e.boobs} BOOBS`).join('\n')
      : 'Nog niemand heeft BOOBS!';
      
    await interaction.reply(`**Leaderboard — Rijkste BOOBS**\n${lines}`);
  }
});

// Punten per bericht
client.on('messageCreate', msg => {
  if (msg.author.bot) return;
  const key = `${msg.author.id}:${msg.guild.id}`;
  points.set(key, (points.get(key) || 0) + 1);
});

// Wallet bij join
client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  let data = wallets.get(member.guild.id);
  if (!data) {
    const phrase = mnemonic.generate();
    const seed = mnemonic.toSeed(phrase);
    data = { masterNode: HDNode.fromSeed(seed), nextIndex: 0 };
    wallets.set(member.guild.id, data);
  }

  const wallet = data.masterNode.derive(data.nextIndex++);
  const address = '0x' + wallet.address.toString('hex');

  try {
    await member.user.send(
      `**Welkom bij VeChain Dreamtips & More!**\n\nJe wallet: \`${address}\`\nTyp \`/balance\` | \`/tip\` | \`/daily\` voor BOOBS!`
    );
  } catch (e) {}
});

client.login(process.env.DISCORD_TOKEN);
