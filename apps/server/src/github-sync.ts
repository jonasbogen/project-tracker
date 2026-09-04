import {
  getProjectIdByGithubMilestone,
  upsertCaseFromGithub,
  upsertProjectFromGithub,
} from './repo.js';

const GITHUB_API = 'https://api.github.com';
const ORG = process.env.GITHUB_ORG || 'intility';
// The single repo of record for OT/Edge Platform customer projects: one milestone
// per customer project, one issue per case/task within that project.
const REPO = process.env.GITHUB_REPO || 'Prosjektmappe';

interface GithubMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
}

interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  milestone: { number: number } | null;
  assignees: { login: string }[];
  pull_request?: unknown;
}

async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GitHub API request failed (${res.status}): ${path}${detail ? ` — ${detail}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function paginate<T>(path: string): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?';
  const results: T[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubFetch<T[]>(`${path}${separator}per_page=100&page=${page}`);
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

function mapProjectStatus(milestone: GithubMilestone): string {
  if (milestone.state === 'closed') return 'Fullført';
  if (milestone.due_on && new Date(milestone.due_on) < new Date()) return 'Forsinket';
  return 'Pågår';
}

// Issue bodies follow a "### Heading\n\nvalue" form template; pull one field's value out.
function extractField(body: string | null, heading: string): string {
  if (!body) return '';
  const match = body.match(new RegExp(`###\\s*${heading}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###|$)`, 'i'));
  return match ? match[1].trim() : '';
}

// The "Kunde" field is filled in per-issue, not per-milestone; use whichever linked
// issue has it set, falling back to the milestone title itself.
function findCustomer(issues: GithubIssue[], milestoneNumber: number): string {
  for (const issue of issues) {
    if (issue.milestone?.number !== milestoneNumber) continue;
    const customer = extractField(issue.body, 'Kunde');
    if (customer) return customer;
  }
  return '';
}

export interface SyncResult {
  projects: number;
  cases: number;
}

// Pulls every milestone (-> project) and every milestone-linked issue (-> case) from
// the single configured GitHub repo. Never throws for one bad issue; logs and keeps
// going so one malformed item can't block the rest of the sync.
export async function syncGithubProjects(): Promise<SyncResult> {
  const milestones = await paginate<GithubMilestone>(
    `/repos/${ORG}/${REPO}/milestones?state=all`,
  );
  const issues = await paginate<GithubIssue>(`/repos/${ORG}/${REPO}/issues?state=all`);

  for (const milestone of milestones) {
    await upsertProjectFromGithub({
      name: milestone.title,
      customer: findCustomer(issues, milestone.number) || milestone.title,
      status: mapProjectStatus(milestone),
      responsible: '',
      end_date: milestone.due_on ? milestone.due_on.slice(0, 10) : null,
      challenges: milestone.description ?? '',
      github_repo: REPO,
      github_milestone_number: milestone.number,
    });
  }

  let caseCount = 0;
  for (const issue of issues) {
    if (issue.pull_request || !issue.milestone) continue;
    try {
      const projectId = await getProjectIdByGithubMilestone(REPO, issue.milestone.number);
      if (!projectId) continue;

      const description = extractField(issue.body, 'Beskrivelse') || issue.body?.trim() || '';
      await upsertCaseFromGithub(projectId, {
        title: issue.title,
        description,
        status: issue.state === 'closed' ? 'Løst' : 'Åpen',
        case_date: issue.created_at.slice(0, 10),
        owner: issue.assignees[0]?.login ?? '',
        github_repo: REPO,
        github_issue_number: issue.number,
      });
      caseCount += 1;
    } catch (err) {
      console.error(`GitHub sync: failed to sync issue #${issue.number}`, err);
    }
  }

  return { projects: milestones.length, cases: caseCount };
}

export interface GithubAssignee {
  login: string;
  avatar_url: string;
}

// Users assignable to issues in the source repo — the pick list for the "Eier" field
// when logging a new case. Read-only, same Issues permission as the rest of the sync.
// Returns an empty list (never throws) when GITHUB_TOKEN is absent, so the case form
// still works with a plain text fallback.
export async function listGithubAssignees(): Promise<GithubAssignee[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    return await paginate<GithubAssignee>(`/repos/${ORG}/${REPO}/assignees`);
  } catch (err) {
    console.error('GitHub sync: failed to list assignees', err);
    return [];
  }
}

export interface NewMilestoneInput {
  title: string;
  description: string;
  due_on: string | null;
}

// The app -> GitHub half of the two-way sync: a project created in the UI becomes a
// milestone in the source repo immediately, instead of waiting to be read back on the
// next hourly pull. Returns null (never throws) when GITHUB_TOKEN is absent or the
// GitHub call fails (e.g. a duplicate title, or a read-only token) — project creation
// in the app must succeed either way.
export async function createGithubMilestone(
  input: NewMilestoneInput,
): Promise<{ number: number } | null> {
  if (!process.env.GITHUB_TOKEN) return null;
  try {
    const body: Record<string, unknown> = { title: input.title };
    if (input.description) body.description = input.description;
    if (input.due_on) body.due_on = `${input.due_on}T00:00:00Z`;
    const milestone = await githubFetch<{ number: number }>(`/repos/${ORG}/${REPO}/milestones`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return milestone;
  } catch (err) {
    console.error('GitHub sync: failed to create milestone', err);
    return null;
  }
}

export function githubRepoName(): string {
  return REPO;
}
