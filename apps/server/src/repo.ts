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
  start_date: string | null;
  end_date: string | null;
  challenges: string;
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

export async function listProjects(): Promise<ProjectWithCount[]> {
  const { rows } = await pool.query<ProjectWithCount>(
    `SELECT p.*, count(c.id)::int AS case_count
     FROM projects p
     LEFT JOIN cases c ON c.project_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
  );
  return rows;
}

export async function getProject(id: number): Promise<Project | undefined> {
  const { rows } = await pool.query<Project>('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0];
}

export async function createProject(data: ProjectInput): Promise<Project> {
  const { rows } = await pool.query<Project>(
    `INSERT INTO projects (name, customer, status, responsible, start_date, end_date, challenges)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
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
         start_date = $5, end_date = $6, challenges = $7
     WHERE id = $8
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
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
