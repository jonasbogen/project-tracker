import { upsertProjectFromGithub } from './repo.js';

const GITHUB_API = 'https://api.github.com';
const ORG = process.env.GITHUB_ORG || 'intility';
// Repos whose name contains this (case-insensitive) count as "OT" repos.
const NAME_FILTER = 'ot';

interface GithubRepo {
  name: string;
}

interface GithubMilestone {
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  due_on: string | null;
  creator: { login: string } | null;
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

async function listOtRepos(): Promise<GithubRepo[]> {
  const matches: GithubRepo[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubFetch<GithubRepo[]>(
      `/orgs/${ORG}/repos?per_page=100&page=${page}`,
    );
    if (batch.length === 0) break;
    matches.push(...batch.filter((r) => r.name.toLowerCase().includes(NAME_FILTER)));
    if (batch.length < 100) break;
  }
  return matches;
}

async function listMilestones(repo: string): Promise<GithubMilestone[]> {
  return githubFetch<GithubMilestone[]>(
    `/repos/${ORG}/${repo}/milestones?state=all&per_page=100`,
  );
}

function mapStatus(milestone: GithubMilestone): string {
  if (milestone.state === 'closed') return 'Fullført';
  if (milestone.due_on && new Date(milestone.due_on) < new Date()) return 'Forsinket';
  return 'Pågår';
}

export interface SyncResult {
  repos: number;
  milestones: number;
}

// Pulls every milestone from every "OT" repo in the org and upserts it as a project.
// Never throws for a single bad repo/milestone; logs and keeps going so one flaky
// repo can't block the rest of the sync.
export async function syncGithubProjects(): Promise<SyncResult> {
  const repos = await listOtRepos();
  let milestoneCount = 0;

  for (const repo of repos) {
    try {
      const milestones = await listMilestones(repo.name);
      for (const milestone of milestones) {
        await upsertProjectFromGithub({
          name: milestone.title,
          customer: repo.name,
          status: mapStatus(milestone),
          responsible: milestone.creator?.login ?? '',
          end_date: milestone.due_on ? milestone.due_on.slice(0, 10) : null,
          challenges: milestone.description ?? '',
          github_repo: repo.name,
          github_milestone_number: milestone.number,
        });
        milestoneCount += 1;
      }
    } catch (err) {
      console.error(`GitHub sync: failed to sync milestones for ${repo.name}`, err);
    }
  }

  return { repos: repos.length, milestones: milestoneCount };
}
