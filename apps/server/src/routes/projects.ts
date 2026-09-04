import { Hono } from 'hono';
import * as repo from '../repo.js';
import type { CaseInput, ProjectInput } from '../repo.js';
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

// GET /api/team/:owner/cases — one person's active cases, with their parent project name.
api.get('/team/:owner/cases', async (c) => {
  const owner = c.req.param('owner');
  const cases = await repo.listActiveCasesByOwner(owner);
  return c.json(cases);
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
