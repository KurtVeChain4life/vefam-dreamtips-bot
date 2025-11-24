const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tip')
    .setDescription('Tip iemand'),
  async execute(interaction) {
    await interaction.reply({ content: 'Tip command in ontwikkeling!', ephemeral: true });
  }
};
