import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  customer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planlagt',
  responsible TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  challenges TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Åpen',
  case_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initSchema(): Promise<void> {
  await pool.query(SCHEMA);
}
