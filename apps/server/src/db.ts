import pg from 'pg';

const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

let memoryState: unknown = null;

export async function initSchema(): Promise<void> {
  if (!pool) {
    console.log('DATABASE_URL not set: game state is kept in memory only');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function loadState(): Promise<unknown> {
  if (!pool) return memoryState;
  const res = await pool.query('SELECT data FROM game_state WHERE id = 1');
  return res.rows[0]?.data ?? null;
}

export async function saveState(data: unknown): Promise<void> {
  if (!pool) {
    memoryState = data;
    return;
  }
  await pool.query(
    `INSERT INTO game_state (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [JSON.stringify(data)],
  );
}

export async function clearState(): Promise<void> {
  if (!pool) {
    memoryState = null;
    return;
  }
  await pool.query('DELETE FROM game_state WHERE id = 1');
}
