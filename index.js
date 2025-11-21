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

const wallets   = new Map();
const balances  = new Map();
const points    = new Map();
const lastDaily = new Map();
const shopItems = new Map(); // id → { title, desc, price, imageUrl }

client.once('ready', async () => {
  console.log(`${client.user.tag} — BOOBS NFT Shop live!`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Tip iemand BOOBS')
      .addUserOption(o => o.setName('user').setDescription('Wie krijgt de BOOBS?').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel BOOBS?').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je VeChain wallet adres'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder()
      .setName('addnft')
      .setDescription('(Owner) Voeg NFT toe aan de shop')
      .addStringOption(o => o.setName('titel').setDescription('Titel van de NFT').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Upload de afbeelding').setRequired(true))
  ].map(c => c.toJSON());

  // Register per guild (werkt meteen, geen cache-probleem)
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }
  console.log('Alle commands geregistreerd!');
});

// ==================== COMMANDS ====================
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const userId = i.user.id;
  const guildId = i.guild.id;
  const key = `${userId}:${guildId}`;

  // ── /addnft ──
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

  // ── Buy knop ──
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

    await i.reply({ content: `Je hebt **${item.title}** gekocht voor **${item.price} BOOBS**!\nDe NFT komt zo naar je wallet.`, ephemeral: false });
    return;
  }

  // (andere commands zoals balance, tip, daily, leaderboard, wallet kun je hieronder plakken uit je vorige versie)
});

client.login(process.env.DISCORD_TOKEN);
