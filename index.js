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

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT MET JOUW DISCORD ID !!!

// Storage
const wallets   = new Map(); // guildId → { masterNode, nextIndex }
const balances  = new Map(); // "userId:guildId" → BOOBS
const points    = new Map();
const lastDaily = new Map();
const shopItems = new Map();

// DE ENIGE JUISTE MANIER OM DUBBELS VOOR ALTIJD TE VERMIJDEN
client.once('ready', async () => {
  console.log(`${client.user.tag} — 100% klaar, geen dubbels meer!`);

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
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Upload afbeelding').setRequired(true))
  ];

  // DIT IS DE MAGISCHE FIX: één keer bij opstarten alles overschrijven
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set(commands);
      console.log(`Commands perfect gezet in ${guild.name}`);
    } catch (e) {
      console.error('Fout bij set commands:', e);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // Guild ID fallback voor DMs
  const guildId = interaction.guild?.id || 'dm';
  const userId = interaction.user.id;
  const key = `${userId}:${guildId}`;

  try {
    // /balance
    if (interaction.commandName === 'balance') {
      const boobs = balances.get(key) || 0;
      const pts = points.get(key) || 0;
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ff69b4')
          .setTitle('Jouw BOOBS Stats')
          .addFields(
            { name: 'BOOBS', value: `\`${boobs}\``, inline: true },
            { name: 'Punten', value: `\`${pts}\``, inline: true }
          )],
        ephemeral: true
      });
    }

    // /tip
    else if (interaction.commandName === 'tip') {
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (!target || target.bot || target.id === userId) return interaction.reply({ content: 'Nice try', ephemeral: true });
      const senderBal = balances.get(key) || 0;
      if (senderBal < amount) return interaction.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      const targetKey = `${target.id}:${guildId}`;
      balances.set(key, senderBal - amount);
      balances.set(targetKey, (balances.get(targetKey) || 0) + amount);

      await interaction.reply(`**${interaction.user} tipped ${amount} BOOBS naar ${target}!**`);
    }

    // /daily
    else if (interaction.commandName === 'daily') {
      const now = Date.now();
      const last = lastDaily.get(key) || 0;
      if (now - last < 86_400_000) {
        const hrs = Math.ceil((86_400_000 - (now - last)) / 3_600_000);
        return interaction.reply({ content: `Nog ${hrs} uur wachten`, ephemeral: true });
      }
      const reward = Math.floor(Math.random() * 401) + 100;
      balances.set(key, (balances.get(key) || 0) + reward);
      lastDaily.set(key, now);
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS!).setDescription(`**${reward} BOOBS** erbij!`)]
      });
    }

    // /leaderboard
    else if (interaction.commandName === 'leaderboard') {
      const top = [...balances.entries()]
        .map(([k, v]) => ({ id: k.split(':')[0], boobs: v }))
        .sort((a, b) => b.boobs - a.boobs)
        .slice(0, 10);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ff1493')
          .setTitle('Top 10 BOOBS Kings')
          .setDescription(top.length ? top.map((t, i) => `${i+1}. <@${t.id}> — **${t.boobs} BOOBS**`).join('\n') : 'Nog niemand')]
      });
    }

    // /wallet — NU 100% WERKEND
    else if (interaction.commandName === 'wallet') {
      let data = wallets.get(guildId);
      if (!data) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        const master = HDNode.fromSeed(seed);
        data = { masterNode: master, nextIndex: 0 };
        wallets.set(guildId, data);
      }
      const derived = data.masterNode.derive(data.nextIndex++);
      const address = '0x' + derived.address.toString('hex');
      await interaction.reply({
        content: `**Je persoonlijke VeChain wallet**\n\`${address}\``,
        ephemeral: true
      });
    }

    // /addnft (owner only)
    else if (interaction.commandName === 'addnft') {
      if (userId !== OWNER_ID) return interaction.reply({ content: 'Alleen de owner mag dit!', ephemeral: true });
      const title = interaction.options.getString('titel');
      const desc = interaction.options.getString('beschrijving');
      const price = interaction.options.getInteger('prijs');
      const att = interaction.options.getAttachment('afbeelding');
      if (!att?.contentType?.startsWith('image/')) return interaction.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

      const id = Date.now().toString();
      shopItems.set(id, { title, desc, price, imageUrl: att.url });
      await interaction.reply({ content: `NFT toegevoegd! **${title}** — ${price} BOOBS`, ephemeral: true });
    }

    // /shop
    else if (interaction.commandName === 'shop') {
      if (shopItems.size === 0) return interaction.reply({ content: 'Shop is leeg!', ephemeral: true });
      const embeds = [];
      const components = [];
      for (const [id, item] of shopItems) {
        embeds.push(new EmbedBuilder()
          .setColor('#ff69b4')
          .setTitle(item.title)
          .setDescription(`${item.desc}\n\n**Prijs:** ${item.price} BOOBS`)
          .setImage(item.imageUrl)
          .setFooter({ text: `ID: ${id}` }));
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`buy_${id}`).setLabel(`Koop voor ${item.price} BOOBS`).setStyle(ButtonStyle.Success)
        ));
      }
      await interaction.reply({ embeds, components });
    }

    // Buy button
    else if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
      const id = interaction.customId.slice(4);
      const item = shopItems.get(id);
      if (!item) return interaction.reply({ content: 'Al verkocht!', ephemeral: true });
      const buyerBal = balances.get(key) || 0;
      if (buyerBal < item.price) return interaction.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      balances.set(key, buyerBal - item.price);
      shopItems.delete(id);

      try {
        const owner = await client.users.fetch(OWNER_ID);
        await owner.send(`NFT VERKOCHT!\nKoper: ${interaction.user.tag}\nNFT: ${item.title}\nPrijs: ${item.price} BOOBS\nWallet: ${key.split(':')[0]}\nAfbeelding: ${item.imageUrl}`);
      } catch {}
      await interaction.reply({ content: `Je kocht **${item.title}** voor **${item.price} BOOBS**! NFT komt zo.` });
    }
  } catch (error) {
    console.error('Error:', error);
    if (!interaction.replied) interaction.reply({ content: 'Er ging iets mis...', ephemeral: true });
  }
});

// BOOBS per 3 tekens (Dreamer of BitGirlowner)
client.on('messageCreate', msg => {
  if (msg.author.bot || !msg.guild || !msg.member) return;
  const key = `${msg.author.id}:${msg.guild.id}`;
  points.set(key, (points.get(key) || 0) + 1);

  if (msg.member.roles.cache.some(r => r.name === 'Dreamer' || r.name === 'BitGirlowner')) {
    const earned = Math.floor(msg.content.length / 3);
    if (earned > 0) balances.set(key, (balances.get(key) || 0) + earned);
  }
});

client.login(process.env.DISCORD_TOKEN);
