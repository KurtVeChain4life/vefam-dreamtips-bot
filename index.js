import { Client, GatewayIntentBits } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';
import CryptoJS from 'crypto-js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages
  ]
});

const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6';

// Simpele in-memory storage (werkt perfect voor start)
const guilds = new Map();

client.once('ready', () => {
  console.log(`VeChain Dreamtips & More is online als ${client.user.tag}!`);
});

client.on('messageCreate', async (msg) => {
  if (msg.content === '!ping') {
    msg.reply('**Pong!** VeChain Dreamtips & More is live!\nWallet creatie actief · Tippen komt zo · NFTs komen zo');
  }
});

client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;

  let guildData = guilds.get(member.guild.id);
  if (!guildData) {
    const newMnemonic = mnemonic.generate();
    const seed = mnemonic.toSeed(newMnemonic);
    const masterNode = HDNode.fromSeed(seed);
    guildData = { masterNode, mnemonic: newMnemonic };
    guilds.set(member.guild.id, guildData);
  }

  const index = guilds.get(member.guild.id).masterNode.size || 0;
  const wallet = guildData.masterNode.derive(index);
  const address = wallet.address.toString('hex');

  // Update counter
  guildData.masterNode.size = index + 1;

  try {
    await member.user.send(
      `**Welkom bij VeChain Dreamtips & More!**\n\nJe persoonlijke VeChain wallet is aangemaakt!\n\n**Adres:** \`0x${address}\`\n\nTyp \`!balance\` of \`!tip @user 10\` binnenkort!`
    );
  } catch (e) {
    console.log("DM blocked for", member.user.tag);
  }
});

client.login(process.env.DISCORD_TOKEN);
