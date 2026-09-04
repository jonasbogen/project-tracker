import { Hono } from 'hono';
import * as repo from '../repo.js';
import type { CaseInput, PriceInput, ProjectInput } from '../repo.js';
import { createGithubMilestone, githubRepoName, listGithubAssignees } from '../github-sync.js';

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
  }),
);

// GET /api/projects — list all projects with a linked-case count, optionally filtered by
// team and/or a free-text search over name/customer.
api.get('/projects', async (c) => {
  const team = c.req.query('team');
  const search = c.req.query('search');
  const projects = await repo.listProjects(team || undefined, search || undefined);
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
// one owner. Backs the "Saker"-board that every case counter in the app links to.
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

// GET /api/prices — the service price list.
api.get('/prices', async (c) => {
  const prices = await repo.listPrices();
  return c.json(prices);
});

function priceFromBody(body: Record<string, unknown>): PriceInput | { error: string } {
  const service = String(body.service ?? '').trim();
  const price = Number(body.price);
  if (!service) return { error: 'Tjeneste er påkrevd.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Ugyldig pris.' };
  return {
    service,
    price,
    unit: String(body.unit ?? '').trim(),
    description: String(body.description ?? '').trim(),
  };
}

// POST /api/prices — add a row to the price list.
api.post('/prices', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = priceFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const price = await repo.createPrice(data);
  return c.json(price, 201);
});

// PUT /api/prices/:id — edit a price list row.
api.put('/prices/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = priceFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  const price = await repo.updatePrice(id, data);
  if (!price) return c.json({ error: 'Fant ikke raden.' }, 404);
  return c.json(price);
});

// DELETE /api/prices/:id — remove a price list row.
api.delete('/prices/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deletePrice(id);
  return c.body(null, 204);
});

// GET /api/assignees — people assignable to issues in the source GitHub repo, for the
// "Eier" picker on the case form. Empty list (not an error) when GITHUB_TOKEN is unset.
api.get('/assignees', async (c) => {
  const assignees = await listGithubAssignees();
  return c.json(assignees);
});

// GET /api/stats — aggregate counts for the dashboard.
api.get('/stats', async (c) => {
  const stats = await repo.getDashboardStats();
  return c.json(stats);
});

// POST /api/projects — create a project, then push it to GitHub as a milestone (the
// app -> GitHub half of the two-way sync). The GitHub call is best-effort: creation in
// the app always succeeds even if GITHUB_TOKEN is absent, read-only, or GitHub is down.
api.post('/projects', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const data = projectFromBody(body);
  if ('error' in data) return c.json({ error: data.error }, 400);
  let project = await repo.createProject(data);

  const milestone = await createGithubMilestone({
    title: project.name,
    description: project.challenges,
    due_on: project.end_date,
  });
  if (milestone) {
    project = (await repo.setProjectGithubLink(project.id, githubRepoName(), milestone.number)) ?? project;
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

// POST /api/projects/:id/cases — add a case to a project.
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
  const created = await repo.createCase(id, data);
  return c.json(created, 201);
});

// DELETE /api/projects/:id/cases/:caseId — remove a case from a project.
api.delete('/projects/:id/cases/:caseId', async (c) => {
  const id = parseId(c.req.param('id'));
  const caseId = parseId(c.req.param('caseId'));
  if (id === null || caseId === null) return c.json({ error: 'Ugyldig id.' }, 400);
  await repo.deleteCase(id, caseId);
  return c.body(null, 204);
});
