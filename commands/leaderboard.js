import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top 10 BOOBS kings'),
  async execute(interaction, pool) {
    const { rows } = await pool.query('SELECT key, boobs FROM balances ORDER BY boobs DESC LIMIT 10');
    const lines = rows.length
      ? rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.boobs}** BOOBS`).join('\n')
      : 'Nog niemand...';

    const embed = new EmbedBuilder()
      .setColor('#ff1493')
      .setTitle('Top 10 BOOBS Kings')
      .setDescription(lines);

    await interaction.reply({ embeds: [embed] });
  }
};
