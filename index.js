import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const OWNER_ID = '495648570968637452'; // ← JOUW DISCORD ID HIER

const wallets   = new Map();
const balances  = new Map();
const points    = new Map();
const lastDaily = new Map();
const shopItems = new Map(); // id → { title, desc, price, imageUrl }

client.once('ready', async () => {
  console.log(`${client.user.tag} BOOBS NFT Shop live!`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('BOOBS & punten'),
    new SlashCommandBuilder().setName('tip').setDescription('Tip BOOBS').addUserOption(o=>o.setName('user').setRequired(true)).addIntegerOption(o=>o.setName('amount').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je VeChain wallet'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder()
      .setName('addnft')
      .setDescription('(Owner) Voeg NFT toe')
      .addStringOption(o => o.setName('titel').setRequired(true).setDescription('Titel'))
      .addStringOption(o => o.setName('beschrijving').setRequired(true).setDescription('Beschrijving'))
      .addIntegerOption(o => o.setName('prijs').setRequired(true).setMinValue(1).setDescription('Prijs in BOOBS'))
      .addAttachmentOption(o => o.setName('afbeelding').setRequired(true).setDescription('Upload afbeelding'))
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(commands);
  }
});

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
    const attachment = i.options.getAttachment('afbeelding');

    if (!attachment.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

    const id = Date.now().toString();
    shopItems.set(id, { title, desc, price, imageUrl: attachment.url });

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

    // DM naar owner
    try {
      const owner = await client.users.fetch(OWNER_ID);
      const buyerWallet = '0x' + (wallets.get(guildId)?.masterNode?.derive(0)?.address?.toString('hex') || 'onbekend');
      await owner.send(`NFT VERKOCHT!\nKoper: ${i.user.tag}\nNFT: **${item.title}**\nPrijs: ${item.price} BOOBS\nWallet: \`${buyerWallet}\`\nAfbeelding: ${item.imageUrl}`);
    } catch (e) {}

    await i.reply({ content: `Je hebt **${item.title}** gekocht voor **${item.price} BOOBS**!\nDe NFT komt zo naar je wallet.`, ephemeral: false });
    return;
  }

  // (andere commands blijven werken zoals voorheen)
});

client.login(process.env.DISCORD_TOKEN);
// Je bestaande getWallet functie hieronder (kopieer uit je vorige versie)

client.login(process.env.DISCORD_TOKEN);
