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
