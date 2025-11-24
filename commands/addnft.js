import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('addnft')
    .setDescription('Voeg NFT toe aan de shop toe (owner only)')
    .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
    .addStringOption(o => o.setName('beschrijving').setDescription('Beschrijving').setRequired(true))
    .addIntegerOption(o => o.setName('prijs').setDescription('Prijs in BOOBS').setRequired(true))
    .addAttachmentOption(o => o.setName('afbeelding').setDescription('Afbeelding van de NFT').setRequired(true)),
  async execute(interaction, pool) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ content: 'Alleen de bot eigenaar mag dit!', ephemeral: true });
    }

    const titel = interaction.options.getString('titel');
    const beschrijving = interaction.options.getString('beschrijving');
    const prijs = interaction.options.getInteger('prijs');
    const img = interaction.options.getAttachment('afbeelding');

    const id = Date.now().toString();
    await pool.query(
      'INSERT INTO shopitems (id, data) VALUES ($1, $2)',
      [id, { titel, beschrijving, prijs, afbeelding: img.url }]
    );

    await interaction.reply({ content: `NFT toegevoegd! **${titel}** – ${prijs} BOOBS`, ephemeral: true });
  }
};
