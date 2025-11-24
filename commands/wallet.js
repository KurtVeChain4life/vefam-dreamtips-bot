import { SlashCommandBuilder } from 'discord.js';
import { mnemonic, HDNode, address } from 'thor-devkit';

export default {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Krijg je persoonlijke VeChain wallet'),

  async execute(interaction, pool) {
    const guildId = interaction.guildId;

    let row = (await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [guildId])).rows[0];

    if (!row) {
      // Nieuwe guild → nieuwe master seed
      const phrase = mnemonic.generate();
      const masterNode = HDNode.fromMnemonic(phrase);
      const seedHex = masterNode.privateKey.toString('hex');

      await pool.query(
        'INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)',
        [guildId, seedHex]
      );
      row = { seed: seedHex, nextIndex: 0 };
    } else {
      await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [guildId]);
    }

    // Derive het volgende adres van de master private key
    const masterNode = HDNode.fromPrivateKey(Buffer.from(row.seed, 'hex'));
    const childNode = masterNode.derive(row.nextIndex || 0);
    const vechainAddress = address.toVC(childNode.address.toString('hex'));

    await interaction.reply({
      content: `**Jouw persoonlijke VeChain wallet**\n\`${vechainAddress}\`\n(Elke gebruiker krijgt een uniek adres)`,
      ephemeral: true
    });
  }
};
