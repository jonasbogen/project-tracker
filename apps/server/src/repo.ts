import { pool } from './db.js';

export const PROJECT_STATUSES = ['Planlagt', 'Pågår', 'Forsinket', 'Fullført'] as const;
export const CASE_STATUSES = ['Åpen', 'Under arbeid', 'Løst'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface Project {
  id: number;
  name: string;
  customer: string;
  status: string;
  responsible: string;
  team: string;
  start_date: string | null;
  end_date: string | null;
  challenges: string;
  github_repo: string | null;
  github_milestone_number: number | null;
  created_at: string;
}

export interface ProjectWithCount extends Project {
  case_count: number;
}

export interface Case {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: string;
  case_date: string | null;
  created_at: string;
}

export interface ProjectInput {
  name: string;
  customer: string;
  status: string;
  responsible: string;
  team?: string;
  start_date?: string | null;
  end_date?: string | null;
  challenges?: string;
}

export interface CaseInput {
  title: string;
  description?: string;
  status?: string;
  case_date?: string | null;
}

export async function listProjects(team?: string): Promise<ProjectWithCount[]> {
  if (team) {
    const { rows } = await pool.query<ProjectWithCount>(
      `SELECT p.*, count(c.id)::int AS case_count
       FROM projects p
       LEFT JOIN cases c ON c.project_id = p.id
       WHERE p.team = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [team],
    );
    return rows;
  }
  const { rows } = await pool.query<ProjectWithCount>(
    `SELECT p.*, count(c.id)::int AS case_count
     FROM projects p
     LEFT JOIN cases c ON c.project_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
  );
  return rows;
}

export async function listTeams(): Promise<string[]> {
  const { rows } = await pool.query<{ team: string }>(
    `SELECT DISTINCT team FROM projects WHERE team <> '' ORDER BY team`,
  );
  return rows.map((r) => r.team);
}

export async function getProject(id: number): Promise<Project | undefined> {
  const { rows } = await pool.query<Project>('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0];
}

export async function createProject(data: ProjectInput): Promise<Project> {
  const { rows } = await pool.query<Project>(
    `INSERT INTO projects (name, customer, status, responsible, team, start_date, end_date, challenges)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
      data.team || '',
      data.start_date || null,
      data.end_date || null,
      data.challenges || '',
    ],
  );
  return rows[0];
}

export async function updateProject(id: number, data: ProjectInput): Promise<Project | undefined> {
  const { rows } = await pool.query<Project>(
    `UPDATE projects
     SET name = $1, customer = $2, status = $3, responsible = $4,
         team = $5, start_date = $6, end_date = $7, challenges = $8
     WHERE id = $9
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
      data.team || '',
      data.start_date || null,
      data.end_date || null,
      data.challenges || '',
      id,
    ],
  );
  return rows[0];
}

export async function deleteProject(id: number): Promise<void> {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
}

export interface GithubMilestoneInput {
  name: string;
  customer: string;
  status: string;
  responsible: string;
  end_date: string | null;
  challenges: string;
  github_repo: string;
  github_milestone_number: number;
}

// One row per (github_repo, github_milestone_number); re-running the sync updates
// the GitHub-derived fields but leaves team as 'OT' and never touches unrelated projects.
export async function upsertProjectFromGithub(data: GithubMilestoneInput): Promise<Project> {
  const { rows } = await pool.query<Project>(
    `INSERT INTO projects (name, customer, status, responsible, team, end_date, challenges, github_repo, github_milestone_number)
     VALUES ($1, $2, $3, $4, 'OT', $5, $6, $7, $8)
     ON CONFLICT (github_repo, github_milestone_number) DO UPDATE
       SET name = EXCLUDED.name,
           customer = EXCLUDED.customer,
           status = EXCLUDED.status,
           responsible = EXCLUDED.responsible,
           end_date = EXCLUDED.end_date,
           challenges = EXCLUDED.challenges
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
      data.end_date,
      data.challenges,
      data.github_repo,
      data.github_milestone_number,
    ],
  );
  return rows[0];
}

export async function listCases(projectId: number): Promise<Case[]> {
  const { rows } = await pool.query<Case>(
    'SELECT * FROM cases WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId],
  );
  return rows;
}

export async function createCase(projectId: number, data: CaseInput): Promise<Case> {
  const { rows } = await pool.query<Case>(
    `INSERT INTO cases (project_id, title, description, status, case_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectId, data.title, data.description || '', data.status || 'Åpen', data.case_date || null],
  );
  return rows[0];
}

export async function deleteCase(projectId: number, caseId: number): Promise<void> {
  await pool.query('DELETE FROM cases WHERE id = $1 AND project_id = $2', [caseId, projectId]);
}
