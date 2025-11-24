import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// IN-MEMORY (werkt altijd, geen DB-fouten)
const wallets = new Map();
const balances = new Map();
const shopItems = new Map();
const OWNER_ID = '495648570968637452'; // ← VERVANG DIT

client.once('ready', async () => {
  console.log(`${client.user.tag} → LIVE & SIMPEL`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS'),
    new SlashCommandBuilder().setName('daily').setDescription('Claim dagelijkse BOOBS'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je VeChain wallet'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe')
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
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

  try {
    if (i.commandName === 'balance') {
      const boobs = balances.get(key) || 0;
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS').setDescription(`**${boobs}** Boobs`)], ephemeral: true });
    }

    if (i.commandName === 'daily') {
      const now = Date.now();
      const lastDailyKey = `${key}_daily`;
      const last = lastDaily.get(lastDailyKey) || 0;
      if (now - last < 86400000) {
        const hrs = Math.ceil((86400000 - (now - last)) / 3600000);
        return i.reply({ content: `Nog **${hrs} uur** wachten!`, ephemeral: true });
      }
      const reward = Math.floor(Math.random() * 401) + 100;
      balances.set(key, (balances.get(key) || 0) + reward);
      lastDaily.set(lastDailyKey, now);
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS!').setDescription(`**${reward} BOOBS** erbij!`)] });
    }

    if (i.commandName === 'wallet') {
      let data = wallets.get(guildId);
      if (!data) {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        data = { masterNode: HDNode.fromSeed(seed), nextIndex: 0 };
        wallets.set(guildId, data);
      }
      const derived = data.masterNode.derive(data.nextIndex++);
      const address = '0x' + derived.address.toString('hex');
      await i.reply({ content: `**Je persoonlijke VeChain wallet**\n\`${address}\``, ephemeral: true });
    }

    if (i.commandName === 'leaderboard') {
      const top = [...balances.entries()]
        .map(([k, v]) => ({ id: k.split(':')[0], boobs: v }))
        .sort((a, b) => b.boobs - a.boobs)
        .slice(0, 10);
      const lines = top.map((t, i) => `${i+1}. <@${t.id}> → **${t.boobs}** BOOBS`).join('\n') || 'Nog niemand...';
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
    }

    if (i.commandName === 'shop') {
      if (shopItems.size === 0) return i.reply({ content: 'Shop is leeg!', ephemeral: true });
      const embeds = [];
      const components = [];
      for (const [id, item] of shopItems) {
        embeds.push(new EmbedBuilder()
          .setColor('#ff69b4')
          .setTitle(item.titel)
          .setDescription(`${item.beschrijving}\n\n**Prijs:** ${item.prijs} BOOBS`)
          .setImage(item.afbeelding));
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`buy_${id}`).setLabel(`Koop voor ${item.prijs}`).setStyle(ButtonStyle.Success)
        ));
      }
      await i.reply({ embeds, components });
    }

    if (i.commandName === 'addnft') {
      if (userId !== OWNER_ID) return i.reply({ content: 'Alleen de owner!', ephemeral: true });
      const titel = i.options.getString('titel');
      const beschrijving = i.options.getString('beschrijving');
      const prijs = i.options.getInteger('prijs');
      const img = i.options.getAttachment('afbeelding');
      if (!img?.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

      const id = Date.now().toString();
      shopItems.set(id, { titel, beschrijving, prijs, afbeelding: img.url });
      await i.reply({ content: `NFT toegevoegd! **${titel}** — ${prijs} BOOBS`, ephemeral: true });
    }

    if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = i.customId.slice(4);
      const item = shopItems.get(id);
      if (!item) return i.reply({ content: 'Al verkocht!', ephemeral: true });

      const bal = balances.get(key) || 0;
      if (bal < item.prijs) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });

      balances.set(key, bal - item.prijs);
      shopItems.delete(id);
      await i.reply({ content: `Je kocht **${item.titel}** voor ${item.prijs} BOOBS!` });
    }

  } catch (err) {
    console.error('Fout:', err);
    if (!i.replied) await i.reply({ content: 'Er ging iets mis!', ephemeral: true }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
