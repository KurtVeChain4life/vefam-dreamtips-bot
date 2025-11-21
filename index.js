import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ==== CONFIG ====
const OWNER_ID = '495648570968637452'; // ← JOUW DISCORD ID HIER

// ==== STORAGE ====
const wallets   = new Map();
const balances  = new Map();
const points    = new Map();
const lastDaily = new Map();
const shopItems = new Map(); // id → { title, desc, price, attachmentUrl }

client.once('ready', async () => {
  console.log(`${client.user.tag} klaar voor BOOBS & NFT verkoop!`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder()
      .setName('tip')
      .setDescription('Drop BOOBS op iemand')
      .addUserOption(o => o.setName('user').setDescription('Wie krijgt de BOOBS?').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel BOOBS?').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je VeChain wallet'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder()
      .setName('addnft')
      .setDescription('(Owner) Voeg NFT toe aan de shop')
      .addStringOption(o => o.setName('titel').setDescription('Titel van de NFT').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Upload de NFT afbeelding').setRequired(true))
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

  // ── /addnft (met upload) ──
  if (i.commandName === 'addnft') {
    if (userId !== OWNER_ID) return i.reply({ content: 'Alleen de eigenaar mag NFTs toevoegen!', ephemeral: true });

    const title = i.options.getString('titel');
    const desc  = i.options.getString('beschrijving');
    const price = i.options.getInteger('prijs');
    const attachment = i.options.getAttachment('afbeelding');

    // Check of het echt een afbeelding is
    if (!attachment.contentType?.startsWith('image/')) {
      return i.reply({ content: 'Alleen afbeeldingen toegestaan!', ephemeral: true });
    }

    const id = Date.now().toString();
    shopItems.set(id, {
      title,
      desc,
      price,
      imageUrl: attachment.url,       // Discord CDN link (werkt altijd)
      proxyUrl: attachment.proxyURL   // fallback
    });

    await i.reply({ content: `NFT toegevoegd aan de shop!\n**${title}** — ${price} BOOBS`, ephemeral: true });
    return;
  }

  // ── /shop ──
  if (i.commandName === 'shop') {
    if (shopItems.size === 0) return i.reply({ content: 'Shop is leeg!', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#ff69b4')
      .setTitle('BOOBS NFT Shop')
      .setDescription('Koop exclusieve NFTs met je BOOBS!');

    const components = [];

    for (const [id, item] of shopItems) {
      embed.addFields({
        name: `${item.title} — ${item.price} BOOBS`,
        value: `${item.desc}\n*Klik op Buy hieronder*`,
        inline: false
      });

      if (item.imageUrl) embed.setImage(item.imageUrl);

      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`buy_${id}`)
            .setLabel(`Buy voor ${item.price} BOOBS`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('')
        )
      );
    }

    await i.reply({ embeds: [embed], components });
    return;
  }

  // ── Buy knop ──
  if (i.isButton() && i.customId.startsWith('buy_')) {
    const itemId = i.customId.slice(4);
    const item = shopItems.get(itemId);
    if (!item) return i.reply({ content: 'Deze NFT is al verkocht!', ephemeral: true });

    const buyerBoobs = balances.get(key) || 0;
    if (buyerBoobs < item.price) return i.reply({ content: `Je hebt niet genoeg BOOBS! (nodig: ${item.price})`, ephemeral: true });

    // Betaling & verwijdering
    balances.set(key, buyerBoobs - item.price);
    shopItems.delete(itemId);

    // DM naar jou
    try {
      const owner = await client.users.fetch(OWNER_ID);
      const buyerWallet = getWallet(userId, guildId); // je bestaande functie
      await owner.send({
        content: `NFT VERKOCHT!\n\nKoper: ${i.user.tag} (${i.user.id})\nNFT: **${item.title}**\nPrijs: ${item.price} BOOBS\nWallet: \`${buyerWallet}\`\nAfbeelding: ${item.imageUrl}`
      });
    } catch (e) {}

    const success = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('Aankoop gelukt!')
      .setDescription(`Je hebt **${item.title}** gekocht voor **${item.price} BOOBS**!\nDe NFT wordt zo snel mogelijk naar je wallet gestuurd.`);
    if (item.imageUrl) success.setImage(item.imageUrl);

    await i.reply({ embeds: [success] });
    return;
  }

  // (de rest van je commands: balance, tip, daily, leaderboard, wallet blijven precies zoals voorheen)
});

// Je bestaande getWallet functie hieronder (kopieer uit je vorige versie)

client.login(process.env.DISCORD_TOKEN);
