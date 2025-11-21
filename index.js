import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const OWNER_ID = '495648570968637452'; // VERVANG DIT

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
    new SlashCommandBuilder().setName('addnft').setDescription('(Owner) Voeg NFT toe')
      .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
      .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
      .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true).setMinValue(1))
      .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true))
  ];

  // DIT IS DE ENIGE MANIER DIE ALTIJD WERKT
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([]);                    // alles weg
    await new Promise(r => setTimeout(r, 3000));     // 3 sec wachten
    await guild.commands.set(commands.map(c => c.toJSON())); // nieuwe erin
    console.log(`✔ ${guild.name} → schoon & uniek`);
  }

  console.log('Klaar – géén dubbels meer, alles werkt direct!');
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;
  const userId = i.user.id;
  const guildId = i.guild.id;
  const key = `${userId}:${guildId}`;

  try {
    if (i.commandName === 'balance') {
      await i.reply({ embeds: [new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw Stats')
        .addFields({ name: 'BOOBS', value: `\`${balances.get(key)||0}\``, inline: true }, { name: 'Punten', value: `\`${points.get(key)||0}\``, inline: true })], ephemeral: true });
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
      await i.reply({ content: `**Je VeChain wallet**\n\`${address}\``, ephemeral: true });
    }
    // (de rest van de commands blijven precies zoals in mijn vorige bericht – je mag ze gewoon laten staan)
    // ik kort ze hier even in voor overzicht, maar je kopieert gewoon het volledige bestand hierboven + de rest van de commands uit mijn vorige bericht
  } catch (e) { console.error(e); }
});

client.login(process.env.DISCORD_TOKEN);
