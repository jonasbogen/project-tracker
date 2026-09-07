import { createHmac, timingSafeEqual } from 'node:crypto';
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
  updated_at: string;
}

interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  milestone: { number: number } | null;
  assignees: { login: string; avatar_url: string }[];
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

// True when the body is the structured issue-form template (Prosjekt/Kunde/
// Tjenesteparaply/Beskrivelse headings), as opposed to plain freeform text.
function isFormTemplate(body: string): boolean {
  return /###\s*(Prosjekt|Kunde|Tjenesteparaply|Beskrivelse)/i.test(body);
}

// The "Beskrivelse" field alone, never the raw template — dumping the whole body
// (with its "### Kunde" / "### Tjenesteparaply" headings and all) as a "description"
// reads as noise. Plain freeform bodies (no template headings at all) are used as-is.
function extractDescription(body: string | null): string {
  const fromField = extractField(body, 'Beskrivelse');
  if (fromField) return fromField;
  if (body && !isFormTemplate(body)) return body.trim();
  return '';
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
      github_updated_at: milestone.updated_at,
    });
  }

  let caseCount = 0;
  for (const issue of issues) {
    if (issue.pull_request || !issue.milestone) continue;
    try {
      const projectId = await getProjectIdByGithubMilestone(REPO, issue.milestone.number);
      if (!projectId) continue;

      const description = extractDescription(issue.body);
      await upsertCaseFromGithub(projectId, {
        title: issue.title,
        description,
        status: issue.state === 'closed' ? 'Løst' : 'Åpen',
        case_date: issue.created_at.slice(0, 10),
        owner: issue.assignees[0]?.login ?? '',
        github_repo: REPO,
        github_issue_number: issue.number,
        github_updated_at: issue.updated_at,
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

// The pick list for the "Eier" field when logging a new issue: people who already
// own at least one open issue in the source repo. Deliberately NOT every user
// GitHub would let you assign (GET .../assignees) — on an org repo that's every
// member with repo access, hundreds of people, useless as a picker. Read-only,
// same Issues permission as the rest of the sync. Returns an empty list (never
// throws) when GITHUB_TOKEN is absent, so the issue form still works with a plain
// text fallback.
export async function listActiveIssueOwners(): Promise<GithubAssignee[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    const issues = await paginate<GithubIssue>(`/repos/${ORG}/${REPO}/issues?state=open`);
    const owners = new Map<string, GithubAssignee>();
    for (const issue of issues) {
      if (issue.pull_request) continue;
      for (const assignee of issue.assignees) owners.set(assignee.login, assignee);
    }
    return [...owners.values()].sort((a, b) => a.login.localeCompare(b.login));
  } catch (err) {
    console.error('GitHub sync: failed to list active issue owners', err);
    return [];
  }
}

export interface RepoTeam {
  slug: string;
  name: string;
}

// Teams with access to the source repo, for the "Team" picker on project
// creation — a small, relevant slice of the org's hundreds of teams (GET
// /orgs/{org}/teams lists literally every team in Intility, not scoped to this
// repo at all). Empty (never throws) when GITHUB_TOKEN is absent.
export async function listRepoTeams(): Promise<RepoTeam[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    const teams = await paginate<RepoTeam>(`/repos/${ORG}/${REPO}/teams`);
    return teams.map((t) => ({ slug: t.slug, name: t.name })).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  } catch (err) {
    console.error('GitHub sync: failed to list repo teams', err);
    return [];
  }
}

// A GitHub team's members, for the "Ansvarlig" picker once a Team is chosen on
// project creation. Empty (never throws) when GITHUB_TOKEN is absent or the team
// doesn't exist.
export async function listTeamMembers(teamSlug: string): Promise<GithubAssignee[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    return await paginate<GithubAssignee>(`/orgs/${ORG}/teams/${teamSlug}/members`);
  } catch (err) {
    console.error(`GitHub sync: failed to list members of team "${teamSlug}"`, err);
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

export interface RecentPullRequest {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  user: string;
}

interface RawPullRequest {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  user: { login: string } | null;
}

export interface RecentPullRequestsResult {
  pulls: RecentPullRequest[];
  // Set when the fetch failed — distinct from a genuinely empty list, since a
  // silent [] here is indistinguishable from "no PR activity" and the two need
  // different fixes (nothing to do, vs. the token's permissions are wrong).
  error: string | null;
}

// The most recently updated pull requests on the source repo — open ones (a
// nudge that something is ready to review/merge on GitHub) and recently
// merged/closed ones (so "nothing to review" doesn't read as "nothing
// happened"), for the "bell" notification on the dashboard. Not something this
// app can act on itself — every entry just links out to GitHub. A single
// request capped at `limit`, not the usual paginate-everything helper: with
// state=all a repo's full PR history could be hundreds of pages, and only the
// most recent handful matter here.
export async function listRecentPullRequests(limit = 10): Promise<RecentPullRequestsResult> {
  if (!process.env.GITHUB_TOKEN) return { pulls: [], error: null };
  try {
    const pulls = await githubFetch<RawPullRequest[]>(
      `/repos/${ORG}/${REPO}/pulls?state=all&sort=updated&direction=desc&per_page=${limit}`,
    );
    return {
      error: null,
      pulls: pulls.map((p) => ({
        number: p.number,
        title: p.title,
        html_url: p.html_url,
        draft: p.draft,
        state: p.state,
        merged_at: p.merged_at,
        updated_at: p.updated_at,
        user: p.user?.login ?? '',
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('GitHub sync: failed to list recent pull requests', err);
    return { pulls: [], error: message };
  }
}

export interface OpenMilestone {
  number: number;
  title: string;
  due_on: string | null;
  description: string | null;
}

// Open milestones in the source repo, for the "koble til eksisterende milestone"
// picker on project creation — an alternative to always minting a new one. Read
// live so a milestone created moments ago on GitHub is selectable immediately,
// without waiting on the periodic pull. Empty (never throws) when GITHUB_TOKEN is
// absent.
export async function listOpenMilestones(): Promise<OpenMilestone[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    const milestones = await paginate<GithubMilestone>(`/repos/${ORG}/${REPO}/milestones?state=open`);
    return milestones
      .map((m) => ({ number: m.number, title: m.title, due_on: m.due_on, description: m.description }))
      .sort((a, b) => a.title.localeCompare(b.title, 'nb'));
  } catch (err) {
    console.error('GitHub sync: failed to list open milestones', err);
    return [];
  }
}

// Verifies a GitHub webhook delivery's HMAC-SHA256 signature against
// GITHUB_WEBHOOK_SECRET (the "Secret" configured on the repo's webhook), so the
// endpoint that triggers an immediate sync can't be poked by anyone who finds the
// URL. `signatureHeader` is the raw "x-hub-signature-256" header value
// ("sha256=<hex>"); `payload` is the exact raw request body GitHub signed.
export function verifyGithubWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}

export interface NewIssueInput {
  title: string;
  description: string;
  status: string;
  owner: string;
  frist: string | null;
  kunde: string;
  tjenesteparaply: string;
  label: string;
  milestoneNumber: number | null;
}

// The app -> GitHub half of the two-way sync for cases: an issue created in the UI
// becomes a real GitHub issue immediately, with the exact same "### Frist" /
// "### Kunde" / "### Tjenesteparaply" / "### Beskrivelse" body sections the repo's
// own "Ny Issue" form (.github/ISSUE_TEMPLATE/oppgave.yml) renders. That's enough
// for the repo's own automation — "Auto-kobling" and "Sett prosjektfelt", both
// triggered on any issues:opened event, form-submitted or not — to pick it up and
// do the rest exactly as it would for a form submission: link it as a sub-issue
// under the chosen Tjenesteparaply, set Kunde as a project field, set Frist as an
// issue field. We only set the milestone directly (the template's "sidepanel"
// concept), which that automation always leaves alone once it's already set.
// A heading is omitted entirely when its value is empty, matching how the repo's
// own automation treats a skipped optional field (never a literal placeholder
// value, which it would otherwise try to act on). Returns null (never throws) when
// GITHUB_TOKEN is absent or the GitHub call fails — issue creation in the app must
// succeed either way.
export async function createGithubIssue(
  input: NewIssueInput,
): Promise<{ number: number } | null> {
  if (!process.env.GITHUB_TOKEN) return null;
  try {
    const sections: string[] = [];
    if (input.frist) sections.push(`### Frist\n\n${input.frist}`);
    if (input.kunde) sections.push(`### Kunde\n\n${input.kunde}`);
    if (input.tjenesteparaply) sections.push(`### Tjenesteparaply\n\n${input.tjenesteparaply}`);
    sections.push(`### Beskrivelse\n\n${input.description}`);

    const body: Record<string, unknown> = {
      title: input.title,
      body: sections.join('\n\n'),
    };
    if (input.milestoneNumber) body.milestone = input.milestoneNumber;
    if (input.owner) body.assignees = [input.owner];
    if (input.label) body.labels = [input.label];

    const issue = await githubFetch<{ number: number }>(`/repos/${ORG}/${REPO}/issues`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (input.status === 'Løst') {
      await githubFetch(`/repos/${ORG}/${REPO}/issues/${issue.number}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });
    }

    return issue;
  } catch (err) {
    console.error('GitHub sync: failed to create issue', err);
    return null;
  }
}

export interface ServiceUmbrella {
  number: number;
  title: string;
}

// The "Tjenesteparaply" dropdown's options: every open issue labeled "tjeneste" in
// the source repo — the same set the repo's own "Auto-kobling" workflow searches
// against when linking a new issue as a sub-issue. Read live (not from the cached
// list in oppgave.yml, which only refreshes on a schedule) so a brand-new umbrella
// is selectable immediately. Empty (never throws) when GITHUB_TOKEN is absent.
export async function listServiceUmbrellas(): Promise<ServiceUmbrella[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    const issues = await paginate<GithubIssue>(
      `/repos/${ORG}/${REPO}/issues?labels=tjeneste&state=open`,
    );
    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({ number: i.number, title: i.title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'nb'));
  } catch (err) {
    console.error('GitHub sync: failed to list service umbrellas', err);
    return [];
  }
}

export interface RepoLabel {
  name: string;
  color: string;
}

// The "Label" dropdown's live options: every label defined on the source repo,
// for the optional Label field on the issue form. Read live (not cached) so a
// label created moments ago on GitHub is selectable immediately. Empty (never
// throws) when GITHUB_TOKEN is absent.
export async function listRepoLabels(): Promise<RepoLabel[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  try {
    const labels = await paginate<{ name: string; color: string }>(`/repos/${ORG}/${REPO}/labels`);
    return labels.map((l) => ({ name: l.name, color: l.color })).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  } catch (err) {
    console.error('GitHub sync: failed to list repo labels', err);
    return [];
  }
}

// Turns a label slug ("ng-nordic") into a display name ("NG Nordic"), the same way
// the repo's own "Synk skjema" workflow does for its label-based Kunde fallback.
function displayNameFromLabelSlug(slug: string): string {
  const knownAcronyms: Record<string, string> = { ng: 'NG', sro: 'SRO', lan: 'LAN' };
  return slug
    .split('-')
    .map((part) => knownAcronyms[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// The canonical "Kunde" list lives in a Kunde single-select field on the org's
// Projects V2 board (org project #318), which needs an org-Projects-scoped token
// most GITHUB_TOKEN values don't have — same reason the repo's own "Synk skjema"
// workflow reads it with a separate PROJECT_TOKEN secret. Set PROJECT_TOKEN here to
// get the full list; without it this returns nothing and the caller falls back.
async function fetchCustomerOptionsFromProjectField(): Promise<string[]> {
  const token = process.env.PROJECT_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($org:String!,$num:Int!,$felt:String!){organization(login:$org){projectV2(number:$num){field(name:$felt){... on ProjectV2SingleSelectField{options{name}}}}}}',
        variables: { org: ORG, num: 318, felt: 'Kunde' },
      }),
    });
    const json = (await res.json()) as {
      data?: { organization?: { projectV2?: { field?: { options?: { name: string }[] } } } };
    };
    return json.data?.organization?.projectV2?.field?.options?.map((o) => o.name) ?? [];
  } catch (err) {
    console.error('GitHub sync: failed to read the Kunde project field', err);
    return [];
  }
}

// The "Synk skjema" workflow's own fallback when it has no PROJECT_TOKEN: repo
// labels described exactly "Kunde", slug-cased names turned back into display names.
async function fetchCustomerOptionsFromLabels(): Promise<string[]> {
  try {
    const labels = await paginate<{ name: string; description: string | null }>(
      `/repos/${ORG}/${REPO}/labels`,
    );
    return labels.filter((l) => l.description === 'Kunde').map((l) => displayNameFromLabelSlug(l.name));
  } catch (err) {
    console.error('GitHub sync: failed to list customer labels', err);
    return [];
  }
}

// The "Kunde" dropdown's options, read live with the exact same fallback chain the
// repo's own "Synk skjema" workflow uses to regenerate the real issue form: the org
// Projects V2 "Kunde" field when a PROJECT_TOKEN is configured, else repo labels
// described "Kunde". Empty (never throws) when GITHUB_TOKEN is absent.
export async function listCustomerOptions(): Promise<string[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  const fromProjectField = await fetchCustomerOptionsFromProjectField();
  const options = fromProjectField.length ? fromProjectField : await fetchCustomerOptionsFromLabels();
  return [...options].sort((a, b) => a.localeCompare(b, 'nb'));
}

// The Projects V2 "Status" field value (Backlog/To do/In progress/Blocked/Done,
// in this org's board) for a batch of issues, in one request via aliased GraphQL
// fields. This is the same board field the Kunde project field lives on, so it
// needs the same org-Projects-scoped PROJECT_TOKEN; without it every issue comes
// back with a null status and the milestone board just shows no status counts.
async function fetchIssueStatuses(issueNumbers: number[]): Promise<Record<number, string | null>> {
  const token = process.env.PROJECT_TOKEN;
  if (!token || issueNumbers.length === 0) return {};
  try {
    const fields = issueNumbers
      .map(
        (n) => `i${n}: issue(number: ${n}) {
          projectItems(first: 10) {
            nodes {
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }`,
      )
      .join('\n');
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query { repository(owner: "${ORG}", name: "${REPO}") { ${fields} } }`,
      }),
    });
    const json = (await res.json()) as {
      data?: {
        repository?: Record<
          string,
          { projectItems?: { nodes?: ({ fieldValueByName?: { name?: string } | null } | null)[] } } | null
        >;
      };
    };
    const repository = json.data?.repository ?? {};
    const result: Record<number, string | null> = {};
    for (const number of issueNumbers) {
      const nodes = repository[`i${number}`]?.projectItems?.nodes ?? [];
      const status = nodes.find((node) => node?.fieldValueByName?.name)?.fieldValueByName?.name;
      result[number] = status ?? null;
    }
    return result;
  } catch (err) {
    console.error('GitHub sync: failed to read issue statuses', err);
    return {};
  }
}

export interface MilestoneBoardIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  assignees: GithubAssignee[];
  status: string | null;
}

export interface MilestoneBoardGroup {
  umbrella: { number: number; title: string; html_url: string } | null;
  total: number;
  completed: number;
  percentCompleted: number;
  issues: MilestoneBoardIssue[];
}

export interface MilestoneBoard {
  statusCounts: { status: string; count: number }[];
  groups: MilestoneBoardGroup[];
}

interface GithubIssueDetailed extends GithubIssue {
  html_url: string;
  parent_issue_url: string | null;
}

function parentNumberFromUrl(url: string | null): number | null {
  const match = url?.match(/\/issues\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

// Mirrors the GitHub Projects board for one milestone: issues grouped under
// their Tjenesteparaply parent (with a completion count scoped to just this
// milestone's issues, not the umbrella's global total), plus Status field
// counts across the whole milestone. The grouping and per-group progress work
// with the plain GITHUB_TOKEN (parent_issue_url is a normal Issues field); the
// top-level status counts need PROJECT_TOKEN (see fetchIssueStatuses) and come
// back empty without it. Never throws — an unreachable repo or missing token
// just yields an empty board.
export async function getMilestoneBoard(milestoneNumber: number): Promise<MilestoneBoard> {
  if (!process.env.GITHUB_TOKEN) return { statusCounts: [], groups: [] };
  try {
    const allIssues = await paginate<GithubIssueDetailed>(
      `/repos/${ORG}/${REPO}/issues?milestone=${milestoneNumber}&state=all`,
    );
    const issues = allIssues.filter((i) => !i.pull_request);

    const parentNumbers = new Set<number>();
    for (const issue of issues) {
      const parentNumber = parentNumberFromUrl(issue.parent_issue_url);
      if (parentNumber) parentNumbers.add(parentNumber);
    }

    const parentEntries = await Promise.all(
      [...parentNumbers].map(async (number): Promise<[number, GithubIssueDetailed] | null> => {
        try {
          const parent = await githubFetch<GithubIssueDetailed>(
            `/repos/${ORG}/${REPO}/issues/${number}`,
          );
          return [number, parent];
        } catch (err) {
          console.error(`GitHub sync: failed to load umbrella issue #${number}`, err);
          return null;
        }
      }),
    );
    const parents = new Map(parentEntries.filter((e) => e !== null));

    const statuses = await fetchIssueStatuses(issues.map((i) => i.number));

    const issuesByParent = new Map<number | null, GithubIssueDetailed[]>();
    for (const issue of issues) {
      const parentNumber = parentNumberFromUrl(issue.parent_issue_url);
      const key = parentNumber && parents.has(parentNumber) ? parentNumber : null;
      const list = issuesByParent.get(key) ?? [];
      list.push(issue);
      issuesByParent.set(key, list);
    }

    const groups: MilestoneBoardGroup[] = [...issuesByParent.entries()].map(([parentNumber, groupIssues]) => {
      const completed = groupIssues.filter((i) => i.state === 'closed').length;
      const total = groupIssues.length;
      const parent = parentNumber !== null ? parents.get(parentNumber) : undefined;
      return {
        umbrella: parent ? { number: parent.number, title: parent.title, html_url: parent.html_url } : null,
        total,
        completed,
        percentCompleted: total ? Math.round((completed / total) * 100) : 0,
        issues: groupIssues.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          html_url: i.html_url,
          assignees: i.assignees,
          status: statuses[i.number] ?? null,
        })),
      };
    });
    groups.sort((a, b) => {
      if (!a.umbrella) return 1;
      if (!b.umbrella) return -1;
      return a.umbrella.title.localeCompare(b.umbrella.title, 'nb');
    });

    const statusCounts = new Map<string, number>();
    for (const status of Object.values(statuses)) {
      if (!status) continue;
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    return { statusCounts: [...statusCounts.entries()].map(([status, count]) => ({ status, count })), groups };
  } catch (err) {
    console.error(`GitHub sync: failed to build the milestone board for #${milestoneNumber}`, err);
    return { statusCounts: [], groups: [] };
  }
}

export interface WeeklyReport {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  body: string;
}

export interface WeeklyReportsResult {
  reports: WeeklyReport[];
  error: string | null;
}

// "Ukesrapport" - one plain GitHub issue per week (.github/workflows/ukesrapport.yml),
// posted every Friday and never closed. Search (not the milestone-scoped sync, which
// skips issues without a milestone entirely) is the simplest way to find the last
// `limit` of them regardless of state. Empty (never throws) when GITHUB_TOKEN is
// absent; a real fetch failure is surfaced as `error` rather than hidden as empty.
export async function listWeeklyReports(limit = 12): Promise<WeeklyReportsResult> {
  if (!process.env.GITHUB_TOKEN) return { reports: [], error: null };
  try {
    const query = `repo:${ORG}/${REPO} in:title Ukesrapport type:issue`;
    const result = await githubFetch<{
      items: { number: number; title: string; html_url: string; created_at: string; body: string | null }[];
    }>(`/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=${limit}`);
    return {
      error: null,
      reports: result.items.map((i) => ({
        number: i.number,
        title: i.title,
        html_url: i.html_url,
        created_at: i.created_at,
        body: i.body ?? '',
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('GitHub sync: failed to list weekly reports', err);
    return { reports: [], error: message };
  }
}

export interface StatusdeckRun {
  id: number;
  created_at: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  // null when no "statusdeck-uke" artifact was found at all (e.g. a failed run) -
  // distinct from `false`, which means the artifact exists and is still downloadable.
  artifactExpired: boolean | null;
}

export interface StatusdeckRunsResult {
  runs: StatusdeckRun[];
  error: string | null;
}

// "Statusdeck" - a weekly workflow run (.github/workflows/statusdeck.yml) whose
// pptx/md/json output is a run *artifact*, not a repo file, and expires after its
// own `retention-days: 30` - well short of the 12 weeks of history wanted here. The
// run list itself has no such expiry, so older weeks still show up here (with a
// link to GitHub) even once their artifact is gone; only `artifactExpired` reflects
// the artifact's own life span. Needs a token with the Actions: Read permission - a
// plain Issues-scoped GITHUB_TOKEN gets a 403 here, surfaced as `error`.
export async function listStatusdeckRuns(limit = 12): Promise<StatusdeckRunsResult> {
  if (!process.env.GITHUB_TOKEN) return { runs: [], error: null };
  try {
    const runsResult = await githubFetch<{
      workflow_runs: {
        id: number;
        created_at: string;
        status: string;
        conclusion: string | null;
        html_url: string;
      }[];
    }>(`/repos/${ORG}/${REPO}/actions/workflows/statusdeck.yml/runs?per_page=${limit}`);

    const runs = await Promise.all(
      runsResult.workflow_runs.map(async (run) => {
        let artifactExpired: boolean | null = null;
        try {
          const artifacts = await githubFetch<{ artifacts: { name: string; expired: boolean }[] }>(
            `/repos/${ORG}/${REPO}/actions/runs/${run.id}/artifacts`,
          );
          const artifact = artifacts.artifacts.find((a) => a.name === 'statusdeck-uke');
          if (artifact) artifactExpired = artifact.expired;
        } catch {
          // Leave artifactExpired null - the run itself still shows.
        }
        return {
          id: run.id,
          created_at: run.created_at,
          status: run.status,
          conclusion: run.conclusion,
          html_url: run.html_url,
          artifactExpired,
        };
      }),
    );

    return { error: null, runs };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('GitHub sync: failed to list statusdeck runs', err);
    return { runs: [], error: message };
  }
}
