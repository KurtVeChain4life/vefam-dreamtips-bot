const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Je persoonlijke VeChain wallet'),
  async execute(interaction) {
    const guildId = interaction.guildId || 'dm';
    let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];

    if (!row) {
      const phrase = mnemonic.generate();
      const seed = mnemonic.toSeed(phrase);
      row = { seed: Buffer.from(seed).toString('hex'), nextIndex: 0 };
      await pool.query('INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)', [guildId, row.seed]);
    } else {
      await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
    }

    const hdNode = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
    const address = '0x' + hdNode.derive(row.nextIndex || 0).address.toString('hex');
    await interaction.reply({ content: `**Je persoonlijke VeChain wallet**\n\`${address}\``, ephemeral: true });
  }
};
