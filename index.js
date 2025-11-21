import { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = TOKEN ? client.application?.id || 'je-client-id' : ''; // wordt later gevuld

const wallets = new Map();
const balances = new Map();
const points = new Map();
const lastDaily = new Map();

const commands = [
  new SlashCommandBuilder().setName('balance').setDescription('Bekijk je BOOBS & punten'),
  new SlashCommandBuilder()
    .setName('tip')
    .setDescription('Drop BOOBS op iemand')
    .addUserOption(o => o.setName('user').setDescription('Wie krijgt de BOOBS?').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Hoeveel BOOBS?').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('daily').setDescription('Claim je dagelijkse BOOBS'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top 10 BOOBS-kings'),
  new SlashCommandBuilder().setName('wallet').setDescription('Je VeChain wallet')
];

// Register commands per server (super snel, geen cache-probleem meer)
client.once('ready', async () => {
  console.log(`${client.user.tag} is live en dropt BOOBS!`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set(commands.map(c => c.toJSON()));
      console.log(`Commands geregistreerd in ${guild.name}`);
    } catch (e) { console.log(e); }
  }
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const userId = i.user.id;
  const guildId = i.guild.id;
  const key = `${userId}:${guildId}`;

  try {
    if (i.commandName === 'balance') {
      const boobs = balances.get(key) || 0;
      const pts = points.get(key) || 0;
      const embed = new EmbedBuilder().setColor('#ff69b4').setTitle('Jouw BOOBS Stats')
        .addFields({ name: 'BOOBS', value: `\`${boobs}\``, inline: true }, { name: 'Punten', value: `\`${pts}\``, inline: true });
      await i.reply({ embeds: [embed], ephemeral: true });
    }

    if (i.commandName === 'tip') {
      const target = i.options.getUser('user');
      const amount = i.options.getInteger('amount');
      if (target.bot || target.id === userId) return i.reply({ content: 'Nice try', ephemeral: true });

      const sender = balances.get(key) || 0;
      if (sender < amount) return i.reply({ content: `Je hebt maar ${sender} BOOBS!`, ephemeral: true });

      const tKey = `${target.id}:${guildId}`;
      balances.set(key, sender - amount);
      balances.set(tKey, (balances.get(tKey) || 0) + amount);

      const embed = new EmbedBuilder().setColor('#ff1493')
        .setDescription(`${i.user} heeft **${amount} BOOBS** gedropt op ${target}!`);
      await i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'daily') {
      const now = Date.now();
      const last = lastDaily.get(key) || 0;
      if (now - last < 86400000) {
        const hrs = Math.ceil((86400000 - (now - last)) / 3600000);
        return i.reply({ content: `Nog ${hrs} uur voor meer BOOBS`, ephemeral: true });
      }
      const reward = Math.floor(Math.random() * 401) + 100;
      balances.set(key, (balances.get(key) || 0) + reward);
      lastDaily.set(key, now);
      const embed = new EmbedBuilder().setColor('#ff69b4').setTitle('Daily BOOBS!')
        .setDescription(`**${reward} BOOBS** op je rekening!`);
      await i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'leaderboard') {
      const top = [...balances.entries()]
        .map(([k, b]) => ({ userId: k.split(':')[0], boobs: b }))
        .sort((a, b) => b.boobs - a.boobs)
        .slice(0, 10);

      const embed = new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings')
        .setDescription(top.length ? top.map((e, i) => `${i+1}. <@${e.userId}> — **${e.boobs} BOOBS**`).join('\n') : 'Nog niemand rijk');
      await i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'wallet') {
      let data = wallets.get(guildId) || (()=> {
        const phrase = mnemonic.generate();
        const seed = mnemonic.toSeed(phrase);
        const nd = { masterNode: HDNode.fromSeed(seed), nextIndex: 0 };
        wallets.set(guildId, nd); return nd;
      })();
      const wallet = data.masterNode.derive(data.nextIndex++);
      const addr = '0x' + wallet.address.toString('hex');
      await i.reply({ content: `**Je wallet**\n\`${addr}\``, ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    await i.reply({ content: 'Er ging iets mis, probeer later nog eens', ephemeral: true });
  }
});

client.on('messageCreate', msg => {
  if (msg.author.bot) return;
  const key = `${msg.author.id}:${msg.guild.id}`;
  points.set(key, (points.get(key) || 0) + 1);
});

client.login(TOKEN);
