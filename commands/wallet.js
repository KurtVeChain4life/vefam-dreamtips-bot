import { SlashCommandBuilder } from 'discord.js';
import { mnemonic, HDNode } from 'thor-devkit';

export default {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Krijg je persoonlijke VeChain wallet'),

  async execute(interaction, pool) {
    const guildId = interaction.guildId;

    // Haal of maak guild wallet seed
    let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];

    if (!row) {
      const phrase = mnemonic.generate();                    // 12 woorden
      const privateKey = HDNode.fromMnemonic(phrase).privateKey; // ← NIEUWE METHODE
      const seedHex = privateKey.toString('hex');

      await pool.query(
        'INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)',
        [guildId, seedHex]
      );
      row = { seed: seedHex, nextIndex: 0 };
    } else {
      await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
    }

    // Derive adres
    const hdNode = HDNode.fromPrivateKey(Buffer.from(row.seed, 'hex'));
    const address = '0x' + hdNode.derive(row.nextIndex || 0).address.toString('hex');

    await interaction.reply({
      content: `**Jouw persoonlijke VeChain wallet**\n\`${address}\`\nSeed wordt veilig bewaard op de server`,
      ephemeral: true
    });
  }
};
