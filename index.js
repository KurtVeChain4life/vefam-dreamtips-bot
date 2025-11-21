import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = 'YOUR_USER_ID_HERE'; // ← VERVANG DIT MET JOUW DISCORD ID !!!

// Storage
const wallets   = new Map(); // guildId → { masterNode, nextIndex }
const balances  = new Map(); // userId:guildId → BOOBS
const points    = new Map(); // userId:guildId → punten
const lastDaily = new Map(); // userId:guildId → timestamp
const shopItems = new Map(); // id → { title, desc, price, imageUrl }

client.once('ready', async () => {
  console.log(`${client.user.tag} — BOOBS economie + NFT shop volledig live!`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Tip iemand BOOBS')
      .addUserOption(o => o.setName('user').setDescription('Wie krijgt de BOOBS?').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel BOOBS?').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS (1× per 24 uur)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder()
      .setName('addnft')
      .setDescription('(Owner) Voeg NFT toe aan de shop')
      .addStringOption(o => o.setName('titel').setDescription('Titel van de NFT').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Upload de afbeelding').setRequired(true))
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }
  console.log('Alle commands geregistreerd!');
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const userId = i.user.id;
  const guildId = i.guild.id;
  const key = `${userId}:${guildId}`;

  // ── /balance ──
  if (i.commandName === 'balance') {
    const boobs = balances.get(key) || 0;
    const pts = points.get(key) || 0;
    const embed = new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS Stats')
      .addFields({ name: 'BOOBS', value: `\`${boobs}\``, inline: true }, { name: 'Punten', value: `\`${pts}\``, inline: true });
    await i.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // ── /tip ──
  if (i.commandName === 'tip') {
    const target = i.options.getUser('user');
    const amount = i.options.getInteger('amount');
    if (target.bot || target.id === userId) return i.reply({ content: 'Nice try', ephemeral: true });
    const sender = balances.get(key) || 0;
    if (sender < amount) return i.reply({ content: `Je hebt maar ${sender} BOOBS!`, ephemeral: true });
    const tKey = `${target.id}:${guildId}`;
    balances.set(key, sender - amount);
    balances.set(tKey, (balances.get(tKey) || 0) + amount);
    await i.reply(`**${i.user} heeft ${amount} BOOBS getipt naar ${target}!**`);
    return;
  }

  // ── /daily (1× per 24 uur) ──
  if (i.commandName === 'daily') {
    const now = Date.now();
    const last = lastDaily.get(key) || 0;
    if (now - last < 86_400_000) {
      const remainingHours = Math.ceil((86_400_000 - (now - last)) / 3_600_000);
      return i.reply({ content: `Je hebt je daily al geclaimed!\nVolgende mogelijk over **${remainingHours} uur**.`, ephemeral: true });
    }
    const reward = Math.floor(Math.random() * 401) + 100;
    balances.set(key, (balances.get(key) || 0) + reward);
    lastDaily.set(key, now);
    const embed = new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS geclaimed!')
      .setDescription(`**${reward} BOOBS** zijn op je rekening gestort!\nKom morgen terug voor meer`);
    await i.reply({ embeds: [embed] });
    return;
  }

  // ── /leaderboard ──
  if (i.commandName === 'leaderboard') {
    const top = [...balances.entries()]
      .map(([k, b]) => ({ userId: k.split(':')[0], boobs: b }))
      .sort((a, b) => b.boobs - a.boobs)
      .slice(0, 10);
    const embed = new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings')
      .setDescription(top.length ? top.map((e, i) => `${i+1}. <@${e.userId}> — **${e.boobs} BOOBS**`).join('\n') : 'Nog niemand rijk');
    await i.reply({ embeds: [embed] });
    return;
  }

  // ── /wallet ──
  if (i.commandName === 'wallet') {
    let data = wallets.get(guildId);
    if (!data) {
      const phrase = mnemonic.generate();
      const seed = mnemonic.toSeed(phrase);
      data = { masterNode: HDNode.fromSeed(seed), nextIndex: 0 };
      wallets.set(guildId, data);
    }
    const wallet = data.masterNode.derive(data.nextIndex);
    const address = '0x' + wallet.address.toString('hex');
    await i.reply({ content: `**Je VeChain wallet**\n\`${address}\``, ephemeral: true });
    return;
  }

  // ── /addnft (owner only) ──
  if (i.commandName === 'addnft') {
    if (userId !== OWNER_ID) return i.reply({ content: 'Alleen de owner mag NFTs toevoegen!', ephemeral: true });
    const title = i.options.getString('titel');
    const desc  = i.options.getString('beschrijving');
    const price = i.options.getInteger('prijs');
    const att   = i.options.getAttachment('afbeelding');
    if (!att.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });
    const id = Date.now().toString();
    shopItems.set(id, { title, desc, price, imageUrl: att.url });
    await i.reply({ content: `NFT toegevoegd!\n**${title}** — ${price} BOOBS`, ephemeral: true });
    return;
  }

  // ── /shop ──
  if (i.commandName === 'shop') {
    if (shopItems.size === 0) return i.reply({ content: 'Shop is momenteel leeg!', ephemeral: true });
    const embeds = [];
    const components = [];
    for (const [id, item] of shopItems) {
      const embed = new EmbedBuilder()
        .setColor('#ff69b4')
        .setTitle(item.title)
        .setDescription(`${item.desc}\n\n**Prijs:** ${item.price} BOOBS`)
        .setImage(item.imageUrl)
        .setFooter({ text: `ID: ${id}` });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${id}`)
          .setLabel(`Koop voor ${item.price} BOOBS`)
          .setStyle(ButtonStyle.Success)
      );
      embeds.push(embed);
      components.push(row);
    }
    await i.reply({ embeds, components });
    return;
  }

  // ── Buy button ──
  if (i.isButton() && i.customId.startsWith('buy_')) {
    const id = i.customId.slice(4);
    const item = shopItems.get(id);
    if (!item) return i.reply({ content: 'Deze NFT is al verkocht!', ephemeral: true });
    const buyerBoobs = balances.get(key) || 0;
    if (buyerBoobs < item.price) return i.reply({ content: `Niet genoeg BOOBS! (nodig: ${item.price})`, ephemeral: true });
    balances.set(key, buyerBoobs - item.price);
    shopItems.delete(id);
    try {
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send(`NFT VERKOCHT!\nKoper: ${i.user.tag} (${i.user.id})\nNFT: **${item.title}**\nPrijs: ${item.price} BOOBS\nAfbeelding: ${item.imageUrl}`);
    } catch (e) {}
    await i.reply({ content: `Je hebt **${item.title}** gekocht voor **${item.price} BOOBS**!\nDe NFT wordt zo snel mogelijk naar je wallet gestuurd.` });
    return;
  }
});

// ── BOOBS PER 3 KARAKTERS (alleen Dreamer of BitGirlowner) + punten voor iedereen ──
client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.guild || !msg.member) return;

  const guildId = msg.guild.id;
  const userId = msg.author.id;
  const key = `${userId}:${guildId}`;

  // Altijd +1 punt
  points.set(key, (points.get(key) || 0) + 1);

  // Alleen BOOBS voor Dreamer of BitGirlowner
  const hasDreamer = msg.member.roles.cache.some(r => r.name === 'Dreamer');
  const hasBitGirlowner = msg.member.roles.cache.some(r => r.name === 'BitGirlowner');

  if (hasDreamer || hasBitGirlowner) {
    const characters = msg.content.length;
    const boobsEarned = Math.floor(characters / 3); // 1 BOOBS per 3 karakters
    if (boobsEarned > 0) {
      balances.set(key, (balances.get(key) || 0) + boobsEarned);
    }
  }
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
    await member.user.send(`**Welkom bij VeChain Dreamtips & More!**\nJe wallet: \`${address}\`\nTyp /daily voor gratis BOOBS!`);
  } catch (e) {}
});

client.login(process.env.DISCORD_TOKEN);
