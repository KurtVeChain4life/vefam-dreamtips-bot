export async function getUserWallet(key) {
  const { rows } = await pool.query('SELECT * FROM wallets WHERE "guildId" = $1', [key.split(':')[1]]);
  let row = rows[0];
  let hdNode, nextIndex = 0;

  if (!row) {
    const phrase = mnemonic.generate();
    const seed = mnemonic.toSeed(phrase);
    hdNode = HDNode.fromSeed(seed);
    await pool.query('INSERT INTO wallets ("guildId", seed, "nextIndex") VALUES ($1, $2, 1)', [key.split(':')[1], Buffer.from(seed).toString('hex')]);
  } else {
    hdNode = HDNode.fromSeed(Buffer.from(row.seed, 'hex'));
    nextIndex = row.nextIndex || 0;
    await pool.query('UPDATE wallets SET "nextIndex" = "nextIndex" + 1 WHERE "guildId" = $1', [key.split(':')[1]]);
  }

  const derived = hdNode.derive(nextIndex);
  return '0x' + derived.address.toString('hex');
}
