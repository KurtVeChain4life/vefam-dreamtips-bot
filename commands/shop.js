import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Bekijk de NFT shop'),
  async execute(interaction, pool) {
    const { rows } = await pool.query('SELECT id, data FROM shopitems ORDER BY id');
    if (rows.length === 0) {
      return interaction.reply({ content: 'Shop is leeg!', ephemeral: true });
    }

    const embeds = rows.map(r => new EmbedBuilder()
      .setColor('#ff69b4')
      .setTitle(r.data.titel)
      .setDescription(`${r.data.beschrijving}\n\n**Prijs:** ${r.data.prijs} BOOBS`)
      .setImage(r.data.afbeelding)
    );

    const components = rows.map(r => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_${r.id}`)
        .setLabel(`Koop – ${r.data.prijs} BOOBS`)
        .setStyle(ButtonStyle.Success)
    ));

    await interaction.reply({ embeds, components });
  },

  async handleBuy(interaction, pool) {
    const id = interaction.customId.split('_')[1];
    const { rows } = await pool.query('SELECT data FROM shopitems WHERE id = $1', [id]);
    if (rows.length === 0) return interaction.reply({ content: 'NFT al verkocht!', ephemeral: true });

    const item = rows[0].data;
    const key = `${interaction.user.id}:${interaction.guildId}`;
    const { rows: bal } = await pool.query('SELECT boobs FROM balances WHERE key = $1', [key]);
    const boobs = bal[0]?.boobs || 0;

    if (boobs < item.prijs) {
      return interaction.reply({ content: 'Niet genoeg BOOBS!', ephemeral: true });
    }

    await pool.query('UPDATE balances SET boobs = boobs - $1 WHERE key = $2', [item.prijs, key]);
    await pool.query('DELETE FROM shopitems WHERE id = $1', [id]);

    await interaction.reply(`Je kocht **${item.titel}** voor ${item.prijs} BOOBS!\nDe owner stuurt je NFT handmatig`);
  }
};
