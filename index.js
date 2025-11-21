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
const shopItems = new Map();

client.once('ready', async () => {
  console.log(`${client.user.tag} → Schoonmaak & registratie gestart`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder().setName('tip').setDescription('Tip iemand BOOBS')
      .addUserOption(o => o.setName('user').setDescription('Wie').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS (1× per 24 uur)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'),
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe aan de shop')
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
  ];

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);
    await new Promise(r => setTimeout(r, 3000));
    await guild.commands.set(commands.map(c => c.toJSON()));
    console.log(`✔ ${guild.name} → commands schoon & uniek`);
  }
  console.log('Bot 100% klaar – ALLE commands werken nu direct!');
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const userId = i.user.id;
  const guildId = i.guild.id;
  const key = `${userId}:${guildId}`;

  try {
    // ==== ALLE COMMANDS ====
    if (i.commandName === 'balance') {
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS Stats')
        .addFields(
          { name: 'BOOBS', value: `\`${balances.get(key) || 0}\``, inline: true },
          { name: 'Punten', value: `\`${points.get(key) || 0}\``, inline: true }
        )], ephemeral: true });
    }

    else if (i.commandName === 'wallet') {
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

    else if (i.commandName === 'daily') {
      const now = Date.now();
      const last = lastDaily.get(key) || 0;
      if (now - last < 86_400_000) {
        const hrs = Math.ceil((86_400_000 - (now - last)) / 3_600_000);
        return i.reply({ content: `Nog ${hrs} uur wachten`, ephemeral: true });
      }
      const reward = Math.floor(Math.random() * 401) + 100;
      balances.set(key, (balances.get(key) || 0) + reward);
      lastDaily.set(key, now);
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS!').setDescription(`**${reward} BOOBS** erbij!`)] });
    }

    else if (i.commandName === 'tip') {
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('amount');
      if (!target || target.bot || target.id === userId) return i.reply({ content: 'Nice try', ephemeral: true });
      const bal = balances.get(key) || 0;
      if (bal < amount) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });
      balances.set(key, bal - amount);
      balances.set(`${target.id}:${guildId}`, (balances.get(`${target.id}:${guildId}`) || 0) + amount);
      await i.reply(`**${i.user} tipped ${amount} BOOBS naar ${target}!**`);
    }

    else if (i.commandName === 'leaderboard') {
      const top = [...balances.entries()]
        .map(([k, v]) => ({ id: k.split(':')[0], boobs: v }))
        .sort((a, b) => b.boobs - a.boobs)
        .slice(0, 10);
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings')
        .setDescription(top.length ? top.map((t, i) => `${i+1}. <@${t.id}> — **${t.boobs} BOOBS**`).join('\n') : 'Nog niemand')] });
    }

    else if (i.commandName === 'shop') {
      if (shopItems.size === 0) return i.reply({ content: 'Shop is momenteel leeg!', ephemeral: true });
      const embeds = [];
      const rows = [];
      for (const [id, item] of shopItems) {
        embeds.push(new EmbedBuilder()
          .setColor('#ff69b4')
          .setTitle(item.title)
          .setDescription(`${item.desc}\n\n**Prijs:** ${item.price} BOOBS`)
          .setImage(item.imageUrl)
          .setFooter({ text: `ID: ${id}` }));
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`buy_${id}`).setLabel(`Koop voor ${item.price} BOOBS`).setStyle(ButtonStyle.Success)
        ));
      }
      await i.reply({ embeds, components: rows });
    }

    else if (i.commandName === 'addnft') {
      if (userId !== OWNER_ID) return i.reply({ content: 'Alleen de owner!', ephemeral: true });
      const title = i.options.getString('titel');
      const desc  = i.options.getString('beschrijving');
      const price = i.options.getInteger('prijs');
      const att   = i.options.getAttachment('afbeelding');
      if (!att?.contentType?.startsWith('image/')) return i.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });
      const id = Date.now().toString();
      shopItems.set(id, { title, desc, price, imageUrl: att.url });
      await i.reply({ content: `NFT toegevoegd! **${title}** — ${price} BOOBS`, ephemeral: true });
    }

    else if (i.isButton() && i.customId.startsWith('buy_')) {
      const id = i.customId.slice(4);
      const item = shopItems.get(id);
      if (!item) return i.reply({ content: 'Al verkocht!', ephemeral: true });
      const bal = balances.get(key) || 0;
      if (bal < item.price) return i.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });
      balances.set(key, bal - item.price);
      shopItems.delete(id);
      try { await (await client.users.fetch(OWNER_ID)).send(`NFT VERKOCHT!\nKoper: ${i.user.tag}\nNFT: ${item.title}\nPrijs: ${item.price} BOOBS\nAfbeelding: ${item.imageUrl}`); } catch {}
      await i.reply({ content: `Je kocht **${item.title}** voor **${item.price} BOOBS**!` });
    }
  } catch (err) {
    console.error('Error:', err);
    if (!i.replied && !i.deferred) await i.reply({ content: 'Er ging iets mis...', ephemeral: true });
  }
});

// BOOBS per 3 tekens
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
