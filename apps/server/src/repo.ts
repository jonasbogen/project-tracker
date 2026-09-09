import { pool } from './db.js';

export const PROJECT_STATUSES = ['Planlagt', 'Pågår', 'Forsinket', 'Fullført'] as const;
export const CASE_STATUSES = ['Åpen', 'Under arbeid', 'Løst'] as const;
export const OFFER_STATUSES = ['Sendt tilbud', 'Godkjent', 'Levert', 'Fakturert'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type OfferStatus = (typeof OFFER_STATUSES)[number];

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
  updated_at: string;
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
  updated_at: string;
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
  owner?: string;
}

export async function listProjects(
  team?: string,
  search?: string,
  status?: string,
  customer?: string,
): Promise<ProjectWithCount[]> {
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
  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (customer) {
    params.push(customer);
    conditions.push(`p.customer = $${params.length}`);
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
         team = $5, start_date = $6, end_date = $7, challenges = $8,
         updated_at = now()
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

// Links an app-created project to the GitHub milestone minted for it (the app -> GitHub
// half of the two-way sync), so the next pull recognizes it and updates in place.
export async function setProjectGithubLink(
  id: number,
  githubRepo: string,
  githubMilestoneNumber: number,
): Promise<Project | undefined> {
  const { rows } = await pool.query<Project>(
    `UPDATE projects SET github_repo = $1, github_milestone_number = $2 WHERE id = $3 RETURNING *`,
    [githubRepo, githubMilestoneNumber, id],
  );
  return rows[0];
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
  // GitHub's own last-modified timestamp for the milestone - the single
  // source of truth for "did this actually change", since it already reflects
  // everything GitHub itself considers a change (title, description, due
  // date, state). Stored directly as our updated_at instead of us trying to
  // detect changes field-by-field.
  github_updated_at: string;
}

// One row per (github_repo, github_milestone_number); re-running the sync updates
// the GitHub-derived fields but leaves team as 'OT' and never touches unrelated projects.
export async function upsertProjectFromGithub(data: GithubMilestoneInput): Promise<Project> {
  const { rows } = await pool.query<Project>(
    `INSERT INTO projects (name, customer, status, responsible, team, end_date, challenges, github_repo, github_milestone_number, updated_at)
     VALUES ($1, $2, $3, $4, 'OT', $5, $6, $7, $8, $9)
     ON CONFLICT (github_repo, github_milestone_number) DO UPDATE
       SET name = EXCLUDED.name,
           customer = EXCLUDED.customer,
           status = EXCLUDED.status,
           responsible = EXCLUDED.responsible,
           end_date = EXCLUDED.end_date,
           challenges = EXCLUDED.challenges,
           updated_at = EXCLUDED.updated_at
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
      data.github_updated_at,
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
  // GitHub's own last-modified timestamp for the issue - the single source of
  // truth for "did this actually change". Unlike comparing our own tracked
  // fields (title/status/owner/etc.), this already reflects *everything*
  // GitHub itself considers activity, including a new comment - which never
  // touches any field we track ourselves, but does bump the issue's own
  // updated_at. Stored directly as our updated_at.
  github_updated_at: string;
}

// One row per (github_repo, github_issue_number); re-running the sync updates the
// GitHub-derived fields on the matching case rather than creating duplicates.
export async function upsertCaseFromGithub(
  projectId: number,
  data: GithubIssueInput,
): Promise<Case> {
  const { rows } = await pool.query<Case>(
    `INSERT INTO cases (project_id, title, description, status, case_date, owner, github_repo, github_issue_number, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (github_repo, github_issue_number) DO UPDATE
       SET project_id = EXCLUDED.project_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           case_date = EXCLUDED.case_date,
           owner = EXCLUDED.owner,
           updated_at = EXCLUDED.updated_at
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
      data.github_updated_at,
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

export interface ActivityItem {
  type: 'project' | 'case';
  id: number;
  title: string;
  project_id: number | null;
  project_name: string | null;
  github_repo: string | null;
  github_number: number | null;
  created_at: string;
  updated_at: string;
}

// The 10 (by default) most recent changes across the whole tool — both brand
// new projects/issues and existing ones that changed — merged into one feed
// and sorted by updated_at. For GitHub-synced rows, updated_at is GitHub's own
// last-modified timestamp (see upsertProjectFromGithub / upsertCaseFromGithub),
// so it reflects anything GitHub itself considers activity - including a new
// comment, which touches none of our own tracked fields but does bump the
// issue's timestamp - without a sync pass that found nothing new making
// everything look "just changed". Backs the "Siste endringer" panel.
export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const { rows } = await pool.query<ActivityItem>(
    `SELECT * FROM (
       SELECT 'project'::text AS type, id, name AS title, NULL::int AS project_id,
              NULL::text AS project_name, github_repo, github_milestone_number AS github_number,
              created_at, updated_at
       FROM projects
       UNION ALL
       SELECT 'case'::text AS type, c.id, c.title, c.project_id,
              p.name AS project_name, c.github_repo, c.github_issue_number AS github_number,
              c.created_at, c.updated_at
       FROM cases c
       JOIN projects p ON p.id = c.project_id
     ) activity
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export interface CalendarItem {
  type: 'project' | 'case';
  id: number;
  project_id: number;
  title: string;
  customer: string;
  date: string;
  github_repo: string | null;
  github_number: number | null;
}

// Every deadline the app knows about, project (milestone due date) and case
// (Frist) alike, on one timeline - backs the Kalender page. Resolved cases are
// left out (their Frist is no longer "approaching"); every project with an end
// date stays in regardless of status, since a milestone's due date is still
// meaningful history once it's done.
export async function listUpcomingDeadlines(): Promise<CalendarItem[]> {
  const { rows } = await pool.query<CalendarItem>(
    `SELECT * FROM (
       SELECT 'project'::text AS type, id, id AS project_id, name AS title, customer,
              end_date AS date, github_repo, github_milestone_number AS github_number
       FROM projects
       WHERE end_date IS NOT NULL
       UNION ALL
       SELECT 'case'::text AS type, c.id, c.project_id, c.title, p.customer,
              c.case_date AS date, c.github_repo, c.github_issue_number AS github_number
       FROM cases c
       JOIN projects p ON p.id = c.project_id
       WHERE c.case_date IS NOT NULL AND c.status <> 'Løst'
     ) deadlines
     ORDER BY date ASC`,
  );
  return rows;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  resolved: number;
}

// Issues resolved per week over the last `weeks` weeks (aligned to ISO weeks,
// Monday-start), zero-filled so a quiet week shows as a real dip rather than a
// gap - backs the dashboard's "Ukes-trend". updated_at is GitHub's own
// last-modified timestamp (see upsertCaseFromGithub), so it reflects the moment
// an issue was actually closed.
export async function getWeeklyTrend(weeks = 8): Promise<WeeklyTrendPoint[]> {
  const { rows } = await pool.query<{ week_start: string; count: number }>(
    `SELECT date_trunc('week', updated_at)::date AS week_start, count(*)::int AS count
     FROM cases
     WHERE status = 'Løst' AND updated_at >= now() - make_interval(weeks => $1)
     GROUP BY week_start`,
    [weeks],
  );
  // date_trunc(...)::date comes back as a JS Date object at runtime (node-postgres's
  // real DATE shape), not the string it looks like - normalize before using as a map key.
  const byWeek = new Map(rows.map((r) => [new Date(r.week_start).toISOString().slice(0, 10), r.count]));

  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0 = Monday
  const thisWeekMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek));
  const points: WeeklyTrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeekMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    points.push({ weekStart: key, resolved: byWeek.get(key) ?? 0 });
  }
  return points;
}

export interface DashboardStats {
  projectStatusCounts: { status: string; count: number }[];
  caseStatusCounts: { status: string; count: number }[];
  upcomingDeadlines: CalendarItem[];
  topOwners: TeamMember[];
  recentActivity: ActivityItem[];
  weeklyTrend: WeeklyTrendPoint[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [projectStatusRows, caseStatusRows, allDeadlines, owners, recentActivity, weeklyTrend] = await Promise.all([
    pool.query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM projects GROUP BY status`,
    ),
    pool.query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM cases GROUP BY status`,
    ),
    listUpcomingDeadlines(),
    listTeam(),
    getRecentActivity(10),
    getWeeklyTrend(8),
  ]);

  // listUpcomingDeadlines() covers the whole timeline (past and future, both
  // projects and cases) for the Kalender page; "Kommende frister" on the
  // dashboard only wants what's still ahead. `date` is a DATE column - a JS
  // Date object at runtime despite the string type - so normalize before the
  // string comparison against today.
  const today = new Date().toISOString().slice(0, 10);
  const upcomingDeadlines = allDeadlines
    .filter((d) => new Date(d.date).toISOString().slice(0, 10) >= today)
    .slice(0, 5);

  return {
    projectStatusCounts: projectStatusRows.rows,
    caseStatusCounts: caseStatusRows.rows,
    upcomingDeadlines,
    topOwners: owners.slice(0, 6),
    recentActivity,
    weeklyTrend,
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
    `INSERT INTO cases (project_id, title, description, status, case_date, owner)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      projectId,
      data.title,
      data.description || '',
      data.status || 'Åpen',
      data.case_date || null,
      data.owner || '',
    ],
  );
  return rows[0];
}

export async function deleteCase(projectId: number, caseId: number): Promise<void> {
  await pool.query('DELETE FROM cases WHERE id = $1 AND project_id = $2', [caseId, projectId]);
}

// Links an app-created case to the GitHub issue minted for it (the app -> GitHub
// half of the two-way sync), so the next pull recognizes it and updates in place.
export async function setCaseGithubLink(
  projectId: number,
  caseId: number,
  githubRepo: string,
  githubIssueNumber: number,
): Promise<Case | undefined> {
  const { rows } = await pool.query<Case>(
    `UPDATE cases SET github_repo = $1, github_issue_number = $2 WHERE id = $3 AND project_id = $4 RETURNING *`,
    [githubRepo, githubIssueNumber, caseId, projectId],
  );
  return rows[0];
}

export interface CaseWithProject extends Case {
  project_name: string;
}

// A person's active (not "Løst") cases across every project, with the parent project's
// name so the UI can link back to it. Backs the "click a person" drill-down.
export async function listActiveCasesByOwner(owner: string): Promise<CaseWithProject[]> {
  const { rows } = await pool.query<CaseWithProject>(
    `SELECT c.*, p.name AS project_name
     FROM cases c
     JOIN projects p ON p.id = c.project_id
     WHERE c.owner = $1 AND c.status <> 'Løst'
     ORDER BY c.case_date DESC NULLS LAST, c.created_at DESC`,
    [owner],
  );
  return rows;
}

export interface CaseWithProjectInfo extends Case {
  project_name: string;
  customer: string;
}

export interface CaseFilters {
  projectId?: number;
  owner?: string;
}

// Every case (any status) across every project, optionally narrowed to one project
// and/or one owner, with the parent project's name and customer for display. Backs
// the "Issues"-board — the click-through target for every case counter in the app.
export async function listAllCases(filters: CaseFilters): Promise<CaseWithProjectInfo[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.projectId) {
    params.push(filters.projectId);
    conditions.push(`c.project_id = $${params.length}`);
  }
  if (filters.owner) {
    params.push(filters.owner);
    conditions.push(`c.owner = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query<CaseWithProjectInfo>(
    `SELECT c.*, p.name AS project_name, p.customer
     FROM cases c
     JOIN projects p ON p.id = c.project_id
     ${where}
     ORDER BY c.case_date DESC NULLS LAST, c.created_at DESC`,
    params,
  );
  return rows;
}

export interface Customer {
  customer: string;
  project_count: number;
  active_count: number;
}

// One row per distinct customer name across all projects, with a count of active
// (not "Fullført") projects alongside the total. Backs the "Kunder" page.
export async function listCustomers(): Promise<Customer[]> {
  const { rows } = await pool.query<Customer>(
    `SELECT customer,
            count(*)::int AS project_count,
            count(*) FILTER (WHERE status <> 'Fullført')::int AS active_count
     FROM projects
     GROUP BY customer
     ORDER BY customer ASC`,
  );
  return rows;
}

export const PRICE_TYPES = ['Service', 'Hardware'] as const;
export const PRICING_MODELS = ['Per unit', 'Tiered'] as const;
export const BILLING_CYCLES = ['Monthly', 'One-time'] as const;

export interface PriceTier {
  id: number;
  price_id: number;
  tier_label: string;
  price: string | null;
  sort_order: number;
}

export interface Price {
  id: number;
  category_id: number;
  service: string;
  type: string;
  description: string;
  pricing_model: string;
  billing: string;
  unit: string;
  price: string | null;
  leasing_price: string | null;
  sort_order: number;
  created_at: string;
  tiers: PriceTier[];
}

export interface PriceCategory {
  id: number;
  name: string;
  sort_order: number;
  prices: Price[];
}

export interface PriceTierInput {
  tier_label: string;
  price: number | null;
}

export interface PriceInput {
  category_id: number;
  service: string;
  type: string;
  description?: string;
  pricing_model: string;
  billing: string;
  unit?: string;
  price?: number | null;
  leasing_price?: number | null;
  tiers?: PriceTierInput[];
}

// Every category with its services (and each service's tiers, if any), in
// display order. Three flat queries assembled in JS rather than a JSON-agg
// query - simpler to read and cheap at this scale (a few dozen rows, total).
export async function listPriceCategories(): Promise<PriceCategory[]> {
  const [{ rows: categories }, { rows: prices }, { rows: tiers }] = await Promise.all([
    pool.query<{ id: number; name: string; sort_order: number }>(
      'SELECT id, name, sort_order FROM price_categories ORDER BY sort_order ASC, name ASC',
    ),
    pool.query<Omit<Price, 'tiers'>>('SELECT * FROM prices ORDER BY sort_order ASC, service ASC'),
    pool.query<PriceTier>('SELECT * FROM price_tiers ORDER BY sort_order ASC, id ASC'),
  ]);

  const tiersByPrice = new Map<number, PriceTier[]>();
  for (const t of tiers) {
    const list = tiersByPrice.get(t.price_id) ?? [];
    list.push(t);
    tiersByPrice.set(t.price_id, list);
  }

  const pricesByCategory = new Map<number, Price[]>();
  for (const p of prices) {
    const list = pricesByCategory.get(p.category_id) ?? [];
    list.push({ ...p, tiers: tiersByPrice.get(p.id) ?? [] });
    pricesByCategory.set(p.category_id, list);
  }

  return categories.map((c) => ({ ...c, prices: pricesByCategory.get(c.id) ?? [] }));
}

export async function createPriceCategory(name: string): Promise<PriceCategory> {
  const { rows } = await pool.query<{ id: number; name: string; sort_order: number }>(
    `INSERT INTO price_categories (name, sort_order)
     VALUES ($1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM price_categories))
     RETURNING id, name, sort_order`,
    [name],
  );
  return { ...rows[0], prices: [] };
}

export async function renamePriceCategory(id: number, name: string): Promise<void> {
  await pool.query('UPDATE price_categories SET name = $1 WHERE id = $2', [name, id]);
}

// Cascades to its services (ON DELETE CASCADE on prices.category_id), which in
// turn cascades to their tiers (ON DELETE CASCADE on price_tiers.price_id).
export async function deletePriceCategory(id: number): Promise<void> {
  await pool.query('DELETE FROM price_categories WHERE id = $1', [id]);
}

// Tiers are always replaced wholesale on write (delete-then-insert) - simpler
// and correct at this scale (a handful of tiers per service) versus diffing
// individual tier rows.
async function replaceTiers(priceId: number, tiers: PriceTierInput[]): Promise<PriceTier[]> {
  await pool.query('DELETE FROM price_tiers WHERE price_id = $1', [priceId]);
  if (tiers.length === 0) return [];
  const values: string[] = [];
  const params: (number | string | null)[] = [];
  tiers.forEach((t, i) => {
    params.push(priceId, t.tier_label, t.price, i);
    values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
  });
  const { rows } = await pool.query<PriceTier>(
    `INSERT INTO price_tiers (price_id, tier_label, price, sort_order)
     VALUES ${values.join(', ')}
     RETURNING *`,
    params,
  );
  return rows.sort((a, b) => a.sort_order - b.sort_order);
}

export async function createPrice(data: PriceInput): Promise<Price> {
  const { rows } = await pool.query<Omit<Price, 'tiers'>>(
    `INSERT INTO prices
       (category_id, service, type, description, pricing_model, billing, unit, price, leasing_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.category_id,
      data.service,
      data.type,
      data.description || '',
      data.pricing_model,
      data.billing,
      data.unit || '',
      data.pricing_model === 'Tiered' ? null : data.price ?? null,
      data.leasing_price ?? null,
    ],
  );
  const tiers = data.pricing_model === 'Tiered' ? await replaceTiers(rows[0].id, data.tiers ?? []) : [];
  return { ...rows[0], tiers };
}

export async function updatePrice(id: number, data: PriceInput): Promise<Price | undefined> {
  const { rows } = await pool.query<Omit<Price, 'tiers'>>(
    `UPDATE prices
     SET category_id = $1, service = $2, type = $3, description = $4, pricing_model = $5,
         billing = $6, unit = $7, price = $8, leasing_price = $9
     WHERE id = $10
     RETURNING *`,
    [
      data.category_id,
      data.service,
      data.type,
      data.description || '',
      data.pricing_model,
      data.billing,
      data.unit || '',
      data.pricing_model === 'Tiered' ? null : data.price ?? null,
      data.leasing_price ?? null,
      id,
    ],
  );
  if (!rows[0]) return undefined;
  const tiers = data.pricing_model === 'Tiered' ? await replaceTiers(id, data.tiers ?? []) : await replaceTiers(id, []);
  return { ...rows[0], tiers };
}

export async function deletePrice(id: number): Promise<void> {
  await pool.query('DELETE FROM prices WHERE id = $1', [id]);
}

export interface Offer {
  id: number;
  customer: string;
  project_id: number | null;
  title: string;
  description: string;
  amount: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OfferWithProject extends Offer {
  project_name: string | null;
}

export interface OfferInput {
  customer: string;
  project_id?: number | null;
  title: string;
  description?: string;
  amount: number;
  status?: string;
}

// Every quote in the funnel, with the linked project's name (if any) for display.
// Backs the "Tilbud" page - the step where the price list meets a customer.
export async function listOffers(): Promise<OfferWithProject[]> {
  const { rows } = await pool.query<OfferWithProject>(
    `SELECT o.*, p.name AS project_name
     FROM offers o
     LEFT JOIN projects p ON p.id = o.project_id
     ORDER BY o.created_at DESC`,
  );
  return rows;
}

export async function createOffer(data: OfferInput): Promise<Offer> {
  const { rows } = await pool.query<Offer>(
    `INSERT INTO offers (customer, project_id, title, description, amount, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.customer,
      data.project_id || null,
      data.title,
      data.description || '',
      data.amount,
      data.status || 'Sendt tilbud',
    ],
  );
  return rows[0];
}

export async function updateOffer(id: number, data: OfferInput): Promise<Offer | undefined> {
  const { rows } = await pool.query<Offer>(
    `UPDATE offers
     SET customer = $1, project_id = $2, title = $3, description = $4,
         amount = $5, status = $6, updated_at = now()
     WHERE id = $7
     RETURNING *`,
    [
      data.customer,
      data.project_id || null,
      data.title,
      data.description || '',
      data.amount,
      data.status || 'Sendt tilbud',
      id,
    ],
  );
  return rows[0];
}

export async function deleteOffer(id: number): Promise<void> {
  await pool.query('DELETE FROM offers WHERE id = $1', [id]);
}
