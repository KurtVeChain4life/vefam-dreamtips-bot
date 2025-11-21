const { Client, GatewayIntentBits } = require('discord.js');
const { HDNode, mnemonic } = require('@vechain/sdk-core');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
const prisma = new PrismaClient();

const MASTER_ENCRYPTION_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex');

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}! VeChain Dreamtips & More is live!`);
});

client.on('messageCreate', (message) => {
  if (message.content.startsWith('!ping')) {
    message.reply('Pong! VeChain Dreamtips & More v1.0 is ready for tips, NFTs & more! 🚀');
  }
});

client.on('guildMemberAdd', async (member) => {
  const guildId = member.guild.id;
  const userId = member.id;

  try {
    // Genereer master seed voor guild als niet bestaat
    let guild = await prisma.guild.findUnique({ where: { discordId: guildId } });
    if (!guild) {
      const masterMnemonic = mnemonic.generate();
      const masterSeed = mnemonic.toSeed(masterMnemonic.split(' '));
      const encryptedSeed = encryptSeed(masterSeed);
      guild = await prisma.guild.create({
        data: { discordId: guildId, masterSeed: encryptedSeed }
      });
    }

    // Derive user wallet
    const masterSeed = decryptSeed(guild.masterSeed);
    const hdNode = HDNode.fromSeed(masterSeed);
    const userIndex = await getUserIndex(guildId, userId);
    const userWallet = hdNode.derivePath(`m/44'/818'/${guild.id}'/0/${userIndex}`);
    const address = userWallet.address;

    // Encrypt private key
    const privateKey = userWallet.privateKey.toString('hex');
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    // Sla op
    await prisma.userWallet.upsert({
      where: { userId_guildId: { userId, guildId } },
      update: { address, encryptedPrivateKey },
      create: { userId, guildId, address, encryptedPrivateKey }
    });

    // DM de user
    member.send(`Welkom bij VeChain Dreamtips & More!\n\nJe persoonlijke VeChain wallet is aangemaakt:\nAdres: ${address}\n\nTyp !balance voor saldo (nog te bouwen).`);
  } catch (error) {
    console.error('Wallet creatie error:', error);
  }
});

function encryptSeed(seed) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(seed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex'), tag: authTag.toString('hex') });
}

function decryptSeed(encryptedData) {
  const { iv, data, tag } = JSON.parse(encryptedData);
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
}

function encryptPrivateKey(privateKeyHex) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', MASTER_ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(privateKeyHex, 'hex', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function getUserIndex(guildId, userId) {
  // Simpele index: hash of userId
  const hash = crypto.createHash('md5').update(userId + guildId).digest('hex');
  return parseInt(hash.slice(0, 8), 16) % 1000000; // Uniek genoeg
}

client.login(process.env.DISCORD_TOKEN);
