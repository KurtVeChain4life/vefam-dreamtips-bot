import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

export default {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Krijg je persoonlijke VeChain wallet'),
  async execute(interaction, pool) {
    const guildId = interaction.guildId;
    let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];

    if (!row) {
      const phrase = mnemonic.generate();
      const seed = mnemonic.toSeed(phrase);
      await pool.query(
        'INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)',
        [guildId, Buffer.from(seed).toString('hex')]
      );
      row = { seed: Buffer.from(seed).toString('hex'), nextIndex: 0 };
    } else {
      await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
    }

    const hdNode = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
    const address = '0x' + hdNode.derive(row.nextIndex || 0).address.toString('hex');

    await interaction.reply({
      content: `**Jouw persoonlijke VeChain wallet**\n\`${address}\``,
      ephemeral: true
    });
  }
};
