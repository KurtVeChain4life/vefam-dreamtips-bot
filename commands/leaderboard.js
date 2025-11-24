const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top 10 BOOBS holders'),
  async execute(interaction) {
      const { rows } = await pool.query('SELECT key, value FROM balances ORDER BY value DESC LIMIT 10');
      const lines = rows.map((r, i) => `${i+1}. <@${r.key.split(':')[0]}> → **${r.value}** BOOBS`).join('\n') || 'No one yet...';
      await interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff1493').setTitle('Top 10 BOOBS Kings').setDescription(lines)] });
  }
};
