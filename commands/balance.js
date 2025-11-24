const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Bekijk je BOOBS saldo'),
  async execute(interaction) {
    const key = `${interaction.user.id}:${interaction.guildId}`;
    const { rows } = await pool.query('SELECT value FROM balances WHERE key = $1', [key]);
    const boobs = rows[0]?.value || 0;
    await interaction.reply({ content: `Je hebt **${boobs} BOOBS**`, ephemeral: true });
  }
};
