import { Hono } from 'hono';
import * as repo from '../repo.js';
import type { CaseInput, ProjectInput } from '../repo.js';
import {
  createGithubIssue,
  createGithubMilestone,
  getMilestoneBoard,
  githubRepoName,
  listActiveIssueOwners,
  listCustomerOptions,
  listOpenMilestones,
  listRecentPullRequests,
  listBlockedIssues,
  listRepoLabels,
  listRepoTeams,
  listServiceUmbrellas,
  listStatusdeckRuns,
  listTeamMembers,
  listWeeklyReports,
  syncGithubProjects,
  verifyGithubWebhookSignature,
} from '../github-sync.js';

const WEBHOOK_SYNC_EVENTS = new Set(['issues', 'milestone', 'label']);

export const api = new Hono();

function parseId(value: string | undefined): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function projectFromBody(body: Record<string, unknown>): ProjectInput | { error: string } {
  const name = String(body.name ?? '').trim();
  const customer = String(body.customer ?? '').trim();
  const responsible = String(body.responsible ?? '').trim();
  const status = String(body.status ?? '').trim();

  if (!name || !customer || !responsible) {
    return { error: 'Navn, kunde og ansvarlig er påkrevd.' };
  }
  if (!repo.PROJECT_STATUSES.includes(status as never)) {
    return { error: 'Ugyldig status.' };
  }

  return {
    name,
    customer,
    responsible,
    status,
    team: String(body.team ?? '').trim(),
    start_date: body.start_date ? String(body.start_date) : null,
    end_date: body.end_date ? String(body.end_date) : null,
    challenges: String(body.challenges ?? '').trim(),
  };
}

// GET /api/meta — status enums used to populate form dropdowns.
api.get('/meta', (c) =>
  c.json({
    projectStatuses: repo.PROJECT_STATUSES,
    caseStatuses: repo.CASE_STATUSES,
    offerStatuses: repo.OFFER_STATUSES,
  }),
);

// GET /api/projects — list all projects with a linked-case count, optionally filtered by
// team and/or a free-text search over name/customer.
api.get('/projects', async (c) => {
  const team = c.req.query('team');
  const search = c.req.query('search');
  const status = c.req.query('status');
  const customer = c.req.query('customer');
  const projects = await repo.listProjects(
    team || undefined,
    search || undefined,
    status || undefined,
    customer || undefined,
  );
  return c.json(projects);
});

// GET /api/teams — distinct team names already in use, for the list filter.
api.get('/teams', async (c) => {
  const teams = await repo.listTeams();
  return c.json(teams);
});

// GET /api/team — people who own cases (from GitHub issue assignees), with counts.
api.get('/team', async (c) => {
  const team = await repo.listTeam();
  return c.json(team);
});

// GET /api/cases — every case (any status), optionally narrowed to one project and/or
// one owner. Backs the "Issuer"-board that every case counter in the app links to.
api.get('/cases', async (c) => {
  const projectId = parseId(c.req.query('project') ?? undefined);
  const owner = c.req.query('owner');
  const cases = await repo.listAllCases({
    projectId: projectId ?? undefined,
    owner: owner || undefined,
  });
  return c.json(cases);
});

// GET /api/customers — every distinct customer across all projects, with counts.
api.get('/customers', async (c) => {
  const customers = await repo.listCustomers();
  return c.json(customers);
});

// GET /api/assignees — people who already own at least one open issue in the
// source repo, for the "Eier" picker on the issue form. Empty list (not an error)
// when GITHUB_TOKEN is unset.
api.get('/assignees', async (c) => {
  const assignees = await listActiveIssueOwners();
  return c.json(assignees);
});

// GET /api/repo-teams — GitHub teams with access to the source repo, for the
// "Team" picker on project creation.
api.get('/repo-teams', async (c) => {
  const teams = await listRepoTeams();
  return c.json(teams);
});

// GET /api/repo-teams/:slug/members — a team's members, for the "Ansvarlig"
// picker once a Team is chosen on project creation.
api.get('/repo-teams/:slug/members', async (c) => {
  const slug = c.req.param('slug');
  const members = await listTeamMembers(slug);
  return c.json(members);
});

// GET /api/customer-options — the "Kunde" dropdown's live options, for the issue
// form. Empty list (not an error) when GITHUB_TOKEN is unset.
api.get('/customer-options', async (c) => {
  const options = await listCustomerOptions();
  return c.json(options);
});

// GET /api/service-umbrellas — the "Tjenesteparaply" dropdown's live options
// (open GitHub issues labeled "tjeneste"), for the issue form. Empty list (not an
// error) when GITHUB_TOKEN is unset.
api.get('/service-umbrellas', async (c) => {
  const umbrellas = await listServiceUmbrellas();
  return c.json(umbrellas);
});

// GET /api/repo-labels — every label defined on the source repo, for the
// optional "Label" field on the issue form. Empty list (not an error) when
// GITHUB_TOKEN is unset.
api.get('/repo-labels', async (c) => {
  const labels = await listRepoLabels();
  return c.json(labels);
});

// GET /api/milestones — open GitHub milestones not yet linked to a project here,
// for the "koble til eksisterende milestone" picker on project creation.
api.get('/milestones', async (c) => {
  const [milestones, projects] = await Promise.all([listOpenMilestones(), repo.listProjects()]);
  const used = new Set(
    projects.filter((p) => p.github_milestone_number != null).map((p) => p.github_milestone_number),
  );
  return c.json(milestones.filter((m) => !used.has(m.number)));
});

// GET /api/pull-requests — the most recently updated pull requests (open and
// recently merged/closed) on the source repo, for the "bell" notification on
// the dashboard.
api.get('/pull-requests', async (c) => {
  const result = await listRecentPullRequests();
  return c.json(result);
});

// GET /api/reports/weekly — the last 12 "Ukesrapport" issues, for the Rapporter archive.
api.get('/reports/weekly', async (c) => {
  const result = await listWeeklyReports();
  return c.json(result);
});

// GET /api/reports/statusdeck — the last 12 Statusdeck workflow runs, for the
// Rapporter archive.
api.get('/reports/statusdeck', async (c) => {
  const result = await listStatusdeckRuns();
  return c.json(result);
});

// GET /api/stats — aggregate counts for the dashboard.
api.get('/stats', async (c) => {
  const stats = await repo.getDashboardStats();
  return c.json(stats);
});

// GET /api/blocked — open issues currently blocked by another open issue (GitHub's
// native issue-dependency link), cross-referenced with our own cases for project
// context. The single most actionable dashboard number: what's stuck, and on whom.
api.get('/blocked', async (c) => {
  const result = await listBlockedIssues();
  if (result.error) return c.json({ items: [], error: result.error });
  const cases = await repo.listAllCases({});
  const byNumber = new Map(
    cases.filter((cs) => cs.github_issue_number != null).map((cs) => [cs.github_issue_number, cs]),
  );
  const items = result.issues.map((issue) => {
    const match = byNumber.get(issue.number);
    return {
      number: issue.number,
      title: issue.title,
      blockedByOwners: issue.blockedByOwners,
      project_id: match?.project_id ?? null,
      project_name: match?.project_name ?? null,
    };
  });
  return c.json({ items, error: null });
});

// GET /api/calendar — every upcoming deadline across the tool: open project end
// dates (milestones) and open case deadlines (Frist), so the calendar page can
// place both kinds of deadline on the same days without a separate live fetch.
api.get('/calendar', async (c) => {
  const items = await repo.listUpcomingDeadlines();
  return c.json(items);
});

// POST /api/projects — create a project, then either link it to an existing open
// GitHub milestone (when the client passes github_milestone_number, from the
// "koble til eksisterende milestone" picker) or push it to GitHub as a brand new
// milestone (the app -> GitHub half of the two-way sync). The GitHub call is
// best-effort: creation in the app always succeeds even if GITHUB_TOKEN is absent,
// read-only, or GitHub is down.
api.post('/projects', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = projectFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  let project = await repo.createProject(data);

  const existingMilestoneNumber =
    typeof body.github_milestone_number === 'number' &&
    Number.isInteger(body.github_milestone_number) &&
    body.github_milestone_number > 0
      ? body.github_milestone_number
      : null;

  if (existingMilestoneNumber) {
    project =
      (await repo.setProjectGithubLink(project.id, githubRepoName(), existingMilestoneNumber)) ?? project;
  } else {
    const milestone = await createGithubMilestone({
      title: project.name,
      description: project.challenges,
      due_on: project.end_date,
    });
    if (milestone) {
      project = (await repo.setProjectGithubLink(project.id, githubRepoName(), milestone.number)) ?? project;
    }
  }

  return c.json(project, 201);
});

// GET /api/projects/:id — a project plus its cases.
api.get('/projects/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const project = await repo.getProject(id);
  if (!project) return c.json({ error: 'Prosjektet finnes ikke.' }, 404);
  const cases = await repo.listCases(id);
  return c.json({ project, cases });
});

// GET /api/projects/:id/board — a live mirror of the GitHub Projects board for
// this project's milestone: issues grouped by Tjenesteparaply with a completion
// count, and Status field totals across the milestone. Empty when the project
// isn't linked to a GitHub milestone.
api.get('/projects/:id/board', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const project = await repo.getProject(id);
  if (!project) return c.json({ error: 'Prosjektet finnes ikke.' }, 404);
  if (!project.github_milestone_number) return c.json({ statusCounts: [], groups: [] });
  const board = await getMilestoneBoard(project.github_milestone_number);
  return c.json(board);
});

// PUT /api/projects/:id — update a project.
api.put('/projects/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = projectFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const project = await repo.updateProject(id, data);
  if (!project) return c.json({ error: 'Prosjektet finnes ikke.' }, 404);
  return c.json(project);
});

// DELETE /api/projects/:id — delete a project (cascades to its cases).
api.delete('/projects/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deleteProject(id);
  return c.body(null, 204);
});

// POST /api/projects/:id/cases — add a case to a project, then push it to GitHub as an
// issue (the app -> GitHub half of the two-way sync), linked to the project's milestone
// when it has one, with the same Frist/Kunde/Tjenesteparaply fields as the repo's own
// "Ny Issue" form. The GitHub call is best-effort: creation in the app always succeeds
// even if GITHUB_TOKEN is absent, read-only, or GitHub is down.
api.post('/projects/:id/cases', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const project = await repo.getProject(id);
  if (!project) return c.json({ error: 'Prosjektet finnes ikke.' }, 404);

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const title = String(body.title ?? '').trim();
  if (!title) return c.json({ error: 'Tittel er påkrevd.' }, 400);
  const status = String(body.status ?? '').trim();
  if (status && !repo.CASE_STATUSES.includes(status as never)) {
    return c.json({ error: 'Ugyldig status.' }, 400);
  }

  const data: CaseInput = {
    title,
    description: String(body.description ?? '').trim(),
    status: status || undefined,
    case_date: body.case_date ? String(body.case_date) : null,
    owner: String(body.owner ?? '').trim(),
  };
  const kunde = String(body.kunde ?? '').trim() || project.customer;
  const tjenesteparaply = String(body.tjenesteparaply ?? '').trim();
  const label = String(body.label ?? '').trim();
  let created = await repo.createCase(id, data);

  const issue = await createGithubIssue({
    title: created.title,
    description: created.description,
    status: created.status,
    owner: created.owner,
    // node-postgres returns a DATE column as a Date object, not the ISO string
    // the Case type claims - so .slice() on it directly throws. new Date(...)
    // normalizes either shape (Date passthrough or a string re-parse) before
    // formatting.
    frist: created.case_date ? new Date(created.case_date).toISOString().slice(0, 10) : null,
    kunde,
    tjenesteparaply,
    label,
    milestoneNumber: project.github_milestone_number,
  });
  if (issue) {
    created = (await repo.setCaseGithubLink(id, created.id, githubRepoName(), issue.number)) ?? created;
  }

  return c.json(created, 201);
});

// POST /api/webhooks/github — lets a change on GitHub (a new/edited issue or
// milestone) reach the app within seconds instead of waiting for the next
// scheduled pull. Configure a webhook on the repo (content type
// application/json, events: Issues, Milestones, Labels) pointed at this URL, with
// its "Secret" set to GITHUB_WEBHOOK_SECRET here. A missing/misconfigured secret,
// or a bad signature, gets the same generic 404 as any unrecognized /api path —
// never a hint that the endpoint exists at all.
api.post('/webhooks/github', async (c) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const raw = await c.req.text();
  const signature = c.req.header('x-hub-signature-256') ?? null;
  if (!secret || !verifyGithubWebhookSignature(secret, raw, signature)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const event = c.req.header('x-github-event') ?? '';
  if (WEBHOOK_SYNC_EVENTS.has(event)) {
    syncGithubProjects().catch((err) => console.error('GitHub webhook sync failed', err));
  }
  return c.body(null, 202);
});

// DELETE /api/projects/:id/cases/:caseId — remove a case from a project.
api.delete('/projects/:id/cases/:caseId', async (c) => {
  const id = parseId(c.req.param('id'));
  const caseId = parseId(c.req.param('caseId'));
  if (id === null || caseId === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deleteCase(id, caseId);
  return c.body(null, 204);
});

function offerFromBody(body: Record<string, unknown>): repo.OfferInput | { error: string } {
  const customer = String(body.customer ?? '').trim();
  const title = String(body.title ?? '').trim();
  const amount = Number(body.amount);
  const status = String(body.status ?? '').trim();
  if (!customer) return { error: 'Kunde er påkrevd.' };
  if (!title) return { error: 'Tittel er påkrevd.' };
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Ugyldig beløp.' };
  if (status && !repo.OFFER_STATUSES.includes(status as never)) return { error: 'Ugyldig status.' };
  const projectId = parseId(body.project_id != null ? String(body.project_id) : undefined);
  return {
    customer,
    title,
    amount,
    status: status || undefined,
    description: String(body.description ?? '').trim(),
    project_id: projectId,
  };
}

// GET /api/offers — every quote in the funnel, newest first.
api.get('/offers', async (c) => {
  const offers = await repo.listOffers();
  return c.json(offers);
});

// POST /api/offers — add a quote to the funnel.
api.post('/offers', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = offerFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const offer = await repo.createOffer(data);
  return c.json(offer, 201);
});

// PUT /api/offers/:id — edit a quote, including moving it to the next funnel stage.
api.put('/offers/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = offerFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const offer = await repo.updateOffer(id, data);
  if (!offer) return c.json({ error: 'Fant ikke tilbudet.' }, 404);
  return c.json(offer);
});

// DELETE /api/offers/:id — remove a quote.
api.delete('/offers/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deleteOffer(id);
  return c.body(null, 204);
});
