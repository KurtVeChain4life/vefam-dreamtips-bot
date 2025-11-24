const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Bekijk de NFT shop'),
  async execute(interaction) {
    const { rows } = await pool.query('SELECT * FROM shopitems');
    if (rows.length === 0) return interaction.reply({ content: 'Shop is leeg!', ephemeral: true });

    const embeds = [];
    const components = [];
    for (const row of rows) {
      const item = row.data;
      embeds.push(new EmbedBuilder().setColor('#ff69b4').setTitle(item.titel).setDescription(`${item.beschrijving}\n**Prijs:** ${item.prijs} BOOBS`).setImage(item.afbeelding));
      components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`buy_${row.id}`).setLabel(`Koop voor ${item.prijs}`).setStyle(ButtonStyle.Success)
      ));
    }
    await interaction.reply({ embeds, components });
  }
};
