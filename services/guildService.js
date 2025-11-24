export async function getGuildConfig(guildId) {
  const { rows } = await pool.query('SELECT * FROM guild_configs WHERE guild_id = $1', [guildId]);
  return rows[0]?.data || { activity_token: 'BOOBS', reward_criteria: { characters_per_boobs: 3, roles: [] }, mint_collection: '0x...' };
}

export async function updateGuildConfig(guildId, config) {
  await pool.query('INSERT INTO guild_configs (guild_id, data) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET data = $2', [guildId, config]);
}
