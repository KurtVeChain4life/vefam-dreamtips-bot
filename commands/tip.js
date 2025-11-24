// commands/tip.js
import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('tip')
    .setDescription('Nog niet geïmplementeerd'),
  async execute(interaction) {
    await interaction.reply({ content: 'Tip command komt later!', ephemeral: true });
  }
};
