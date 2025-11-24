import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim je dagelijkse 100-500 BOOBS'),
  async execute(interaction, pool) {
    const key = `${interaction.user.id}:${interaction.guildId}`;
    const now = Date.now();
    const { rows } = await pool.query('SELECT timestamp FROM lastdaily WHERE key = $1', [key]);
    const last = rows[0]?.timestamp || 0;

    if (now - last < 86400000) {
      return interaction.reply({ content: 'Je hebt vandaag al je daily geclaimd!', ephemeral: true });
    }

    const reward = Math.floor(Math.random() * 401) + 100;
    await pool.query(
      `INSERT INTO balances (key, boobs) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET boobs = balances.boobs + $2`,
      [key, reward]
    );
    await pool.query(
      `INSERT INTO lastdaily (key, timestamp) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET timestamp = $2`,
      [key, now]
    );

    await interaction.reply(`Je kreeg **${reward} BOOBS** vandaag!`);
  }
};
