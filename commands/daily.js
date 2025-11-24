const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim je dagelijkse BOOBS'),
  async execute(interaction) {
    const key = `${interaction.user.id}:${interaction.guildId}`;
    const now = Date.now();
    const { rows } = await pool.query('SELECT timestamp FROM lastdaily WHERE key = $1', [key]);
    const last = rows[0]?.timestamp || 0;
    if (now - last < 86400000) return interaction.reply({ content: 'Je hebt vandaag al geclaimd!', ephemeral: true });

    const reward = Math.floor(Math.random() * 401) + 100;
    await pool.query('INSERT INTO balances (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = balances.value + $2', [key, reward]);
    await pool.query('INSERT INTO lastdaily (key, timestamp) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamp = $2', [key, now]);
    await interaction.reply(`Je kreeg **${reward} BOOBS**!`);
  }
};
