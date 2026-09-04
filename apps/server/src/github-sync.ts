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
  pull_request?: unknown;
}

async function githubFetch<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API request failed (${res.status}): ${path}`);
  }
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
