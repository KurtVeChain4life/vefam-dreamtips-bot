import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Bekijk je BOOBS saldo'),
  async execute(interaction, pool) {
    const key = `${interaction.user.id}:${interaction.guildId}`;
    const { rows } = await pool.query('SELECT boobs FROM balances WHERE key = $1', [key]);
    const boobs = rows[0]?.boobs || 0;
    await interaction.reply({ content: `Je hebt **${boobs} BOOBS**`, ephemeral: true });
  }
};
