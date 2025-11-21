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

const wallets = new Map(); // guildId → { nextIndex, masterNode }

client.once('ready', () => {
  console.log(`VeChain Dreamtips & More online als ${client.user.tag}`);
});

client.on('messageCreate', msg => {
  if (msg.content === '!ping') {
    msg.reply('**Pong!** VeChain Dreamtips & More is live en klaar voor actie!');
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
      `**Welkom bij VeChain Dreamtips & More!**\n\nJe persoonlijke VeChain wallet is klaar:\n\`${address}\`\n\nBinnenkort: !tip, daily spin, NFTs en leaderboard!`
    );
  } catch (e) {}
});

client.login(process.env.DISCORD_TOKEN);
