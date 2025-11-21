import { Client, GatewayIntentBits } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages
  ]
});

// Storage
const wallets = new Map();     // guildId → { masterNode, nextIndex }
const balances = new Map();    // userId:guildId → aantal VET (in-memory)
const points = new Map();      // userId:guildId → punten

client.once('ready', () => {
  console.log(`VeChain Dreamtips & More online als ${client.user.tag}`);
});

client.on('messageCreate', async msg => {
  if (msg.author.bot) return;

  const guildId = msg.guild.id;
  const userId = msg.author.id;
  const key = `${userId}:${guildId}`;

  // Punten per bericht
  points.set(key, (points.get(key) || 0) + 1);

  if (msg.content === '!ping') {
    msg.reply('**Pong!** VeChain Dreamtips & More is live!\nTippen & punten actief!');
  }

  if (msg.content === '!balance') {
    const balance = balances.get(key) || 0;
    const pts = points.get(key) || 0;
    msg.reply(`**Jouw stats**\nVET: \`${balance}\`\nPunten: \`${pts}\``);
  }

  if (msg.content.startsWith('!tip ')) {
    const args = msg.content.split(' ');
    if (args.length < 3) return msg.reply('Gebruik: `!tip @user bedrag`');

    const target = msg.mentions.users.first();
    if (!target || target.bot) return msg.reply('Tag een echte user!');
    if (target.id === userId) return msg.reply('Je kunt niet naar jezelf tippen!');

    const amount = parseInt(args[2]);
    if (isNaN(amount) || amount <= 0) return msg.reply('Bedrag moet een getal zijn!');

    const senderBal = balances.get(key) || 0;
    if (senderBal < amount) return msg.reply(`Je hebt maar ${senderBal} VET!`);

    const targetKey = `${target.id}:${guildId}`;
    balances.set(key, senderBal - amount);
    balances.set(targetKey, (balances.get(targetKey) || 0) + amount);

    msg.reply(`✅ **${amount} VET getipt naar <@${target.id}>!**`);
  }
});

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
      `**Welkom bij VeChain Dreamtips & More!**\n\nJe wallet: \`${address}\`\n\nTyp \`!balance\` voor je punten & VET!\nTip met \`!tip @user 10\``
    );
  } catch (e) {}
});

client.login(process.env.DISCORD_TOKEN);
