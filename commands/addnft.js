const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addnft')
    .setDescription('Voeg NFT toe aan shop (owner only)')
    .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
    .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
    .addIntegerOption(o => o.setName('prijs').setDescription('Prijs').setRequired(true))
    .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding').setRequired(true)),
  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Alleen de owner!', ephemeral: true });
    const titel = interaction.options.getString('titel');
    const beschrijving = interaction.options.getString('beschrijving');
    const prijs = interaction.options.getInteger('prijs');
    const att = interaction.options.getAttachment('afbeelding');
    if (!att?.contentType?.startsWith('image/')) return interaction.reply({ content: 'Alleen afbeeldingen!', ephemeral: true });

    const id = Date.now().toString();
    await pool.query('INSERT INTO shopitems (id, data) VALUES ($1, $2)', [id, { titel, beschrijving, prijs, afbeelding: att.url }]);
    await interaction.reply({ content: `NFT toegevoegd! **${titel}** — ${prijs} BOOBS`, ephemeral: true });
  }
};
