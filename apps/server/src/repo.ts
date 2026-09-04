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
  owner: string;
  github_repo: string | null;
  github_issue_number: number | null;
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

export async function listProjects(team?: string, search?: string): Promise<ProjectWithCount[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  if (team) {
    params.push(team);
    conditions.push(`p.team = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.customer ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<ProjectWithCount>(
    `SELECT p.*, count(c.id)::int AS case_count
     FROM projects p
     LEFT JOIN cases c ON c.project_id = p.id
     ${where}
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    params,
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

export async function getProjectIdByGithubMilestone(
  githubRepo: string,
  milestoneNumber: number,
): Promise<number | undefined> {
  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM projects WHERE github_repo = $1 AND github_milestone_number = $2',
    [githubRepo, milestoneNumber],
  );
  return rows[0]?.id;
}

export interface GithubIssueInput {
  title: string;
  description: string;
  status: string;
  case_date: string | null;
  owner: string;
  github_repo: string;
  github_issue_number: number;
}

// One row per (github_repo, github_issue_number); re-running the sync updates the
// GitHub-derived fields on the matching case rather than creating duplicates.
export async function upsertCaseFromGithub(
  projectId: number,
  data: GithubIssueInput,
): Promise<Case> {
  const { rows } = await pool.query<Case>(
    `INSERT INTO cases (project_id, title, description, status, case_date, owner, github_repo, github_issue_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (github_repo, github_issue_number) DO UPDATE
       SET project_id = EXCLUDED.project_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           case_date = EXCLUDED.case_date,
           owner = EXCLUDED.owner
     RETURNING *`,
    [
      projectId,
      data.title,
      data.description,
      data.status,
      data.case_date,
      data.owner,
      data.github_repo,
      data.github_issue_number,
    ],
  );
  return rows[0];
}

export interface TeamMember {
  owner: string;
  open_cases: number;
  total_cases: number;
}

export async function listTeam(): Promise<TeamMember[]> {
  const { rows } = await pool.query<TeamMember>(
    `SELECT owner,
            count(*) FILTER (WHERE status <> 'Løst')::int AS open_cases,
            count(*)::int AS total_cases
     FROM cases
     WHERE owner <> ''
     GROUP BY owner
     ORDER BY total_cases DESC, owner ASC`,
  );
  return rows;
}

export interface DashboardStats {
  projectStatusCounts: { status: string; count: number }[];
  caseStatusCounts: { status: string; count: number }[];
  upcomingDeadlines: { id: number; name: string; customer: string; end_date: string }[];
  topOwners: TeamMember[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [projectStatusRows, caseStatusRows, deadlineRows, owners] = await Promise.all([
    pool.query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM projects GROUP BY status`,
    ),
    pool.query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM cases GROUP BY status`,
    ),
    pool.query<{ id: number; name: string; customer: string; end_date: string }>(
      `SELECT id, name, customer, end_date FROM projects
       WHERE end_date IS NOT NULL AND end_date >= current_date
       ORDER BY end_date ASC
       LIMIT 5`,
    ),
    listTeam(),
  ]);

  return {
    projectStatusCounts: projectStatusRows.rows,
    caseStatusCounts: caseStatusRows.rows,
    upcomingDeadlines: deadlineRows.rows,
    topOwners: owners.slice(0, 6),
  };
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
