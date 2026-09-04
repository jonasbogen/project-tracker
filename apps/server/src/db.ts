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
  team TEXT NOT NULL DEFAULT '',
  start_date DATE,
  end_date DATE,
  challenges TEXT NOT NULL DEFAULT '',
  github_repo TEXT,
  github_milestone_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_milestone_number INTEGER;

-- One project per GitHub milestone; NULLs (manually created projects) never conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS projects_github_unique_idx
  ON projects (github_repo, github_milestone_number);

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Åpen',
  case_date DATE,
  owner TEXT NOT NULL DEFAULT '',
  github_repo TEXT,
  github_issue_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cases ADD COLUMN IF NOT EXISTS github_repo TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS github_issue_number INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT '';

-- One case per GitHub issue; NULLs (manually created cases) never conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS cases_github_unique_idx
  ON cases (github_repo, github_issue_number);

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initSchema(): Promise<void> {
  await pool.query(SCHEMA);
}
