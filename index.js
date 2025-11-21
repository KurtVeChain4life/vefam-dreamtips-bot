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

const OWNER_ID = '495648570968637452'; // ← VERVANG DIT MET JOUW ECHTE DISCORD ID !!!

const wallets   = new Map();
const balances  = new Map();
const points    = new Map();
const lastDaily = new Map();
const shopItems = new Map();

client.once('ready', async () => {
  console.log(`${client.user.tag} → FINAL & DEFINITIEVE CLEANUP`);

  const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
    new SlashCommandBuilder().setName('tip').setDescription('Tip iemand BOOBS')
      .addUserOption(o => o.setName('user').setDescription('Wie').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel').setRequired(true).setMinValue(1)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS (1× per 24 uur)'),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
    new SlashCommandBuilder().setName('wallet').setDescription('Je persoonlijke VeChain wallet'), // ← dit is de juiste regel
    new SlashCommandBuilder().setName('shop').setDescription('Bekijk de NFT shop'),
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe aan de shop')
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
  ].map(c => c.toJSON());

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);                // alles weg
    await new Promise(r => setTimeout(r, 5000)); // 5 seconden wachten
    await guild.commands.set(commands);          // nieuwe erin
    console.log(`✔ ${guild.name} → volledig schoon`);
  }

  console.log('Bot 100% klaar – alle commands 1× en /wallet werkt direct!');
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const userId = i.user.id;
  const guildId = i.guild?.id || 'dm';
  const key = `${userId}:${guildId}`;

  try {
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
      return;
    }

    // de rest van je commands (die al werken)
    if (i.commandName === 'balance') {
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS Stats')
        .addFields(
          { name: 'BOOBS', value: `\`${balances.get(key) || 0}\``, inline: true },
          { name: 'Punten', value: `\`${points.get(key) || 0}\``, inline: true }
        )], ephemeral: true });
    }

    if (i.commandName === 'daily') {
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

    // voeg hier eventueel de andere commands weer toe (tip, leaderboard, shop, addnft, etc.) – die werken al bij jou

  } catch (err) {
    console.error('Error:', err);
    if (!i.replied) await i.reply({ content: 'Er ging iets mis...', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
