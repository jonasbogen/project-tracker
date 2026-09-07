import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createApp } from './app.js';
import * as repo from './repo.js';
import * as githubSync from './github-sync.js';

vi.mock('./repo.js', async (importActual) => {
  const actual = await importActual<typeof import('./repo.js')>();
  return {
    ...actual,
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    setProjectGithubLink: vi.fn(),
    listCases: vi.fn(),
    createCase: vi.fn(),
    setCaseGithubLink: vi.fn(),
    listTeam: vi.fn(),
    getDashboardStats: vi.fn(),
    listAllCases: vi.fn(),
    listCustomers: vi.fn(),
    listPrices: vi.fn(),
    createPrice: vi.fn(),
    updatePrice: vi.fn(),
    deletePrice: vi.fn(),
  };
});

// Keeps this suite hermetic: no test here should ever reach the real GitHub API.
vi.mock('./github-sync.js', () => ({
  createGithubMilestone: vi.fn().mockResolvedValue(null),
  createGithubIssue: vi.fn().mockResolvedValue(null),
  listActiveIssueOwners: vi.fn().mockResolvedValue([]),
  listCustomerOptions: vi.fn().mockResolvedValue([]),
  listServiceUmbrellas: vi.fn().mockResolvedValue([]),
  listOpenMilestones: vi.fn().mockResolvedValue([]),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  getMilestoneBoard: vi.fn().mockResolvedValue({ statusCounts: [], groups: [] }),
  listRepoTeams: vi.fn().mockResolvedValue([]),
  listTeamMembers: vi.fn().mockResolvedValue([]),
  githubRepoName: vi.fn().mockReturnValue('Prosjektmappe'),
  syncGithubProjects: vi.fn().mockResolvedValue({ projects: 0, cases: 0 }),
  verifyGithubWebhookSignature: vi.fn().mockReturnValue(false),
}));

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('project-tracker API', () => {
  it('GET /api/meta returns the status enums', async () => {
    const res = await app.request('/api/meta');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      projectStatuses: repo.PROJECT_STATUSES,
      caseStatuses: repo.CASE_STATUSES,
    });
  });

  it('GET /api/projects returns the list from the repo', async () => {
    vi.mocked(repo.listProjects).mockResolvedValue([
      {
        id: 1,
        name: 'Migrering',
        customer: 'Acme',
        status: 'Pågår',
        responsible: 'Jonas',
        team: 'OT',
        start_date: null,
        end_date: null,
        challenges: '',
        github_repo: null,
        github_milestone_number: null,
        created_at: '2026-08-05T00:00:00Z',
        case_count: 2,
      },
    ]);

    const res = await app.request('/api/projects');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Migrering');
  });

  it('POST /api/projects validates required fields', async () => {
    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', customer: '', responsible: '', status: 'Planlagt' }),
    });
    expect(res.status).toBe(400);
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it('POST /api/projects creates a valid project', async () => {
    vi.mocked(repo.createProject).mockResolvedValue({
      id: 5,
      name: 'Ny',
      customer: 'Acme',
      status: 'Planlagt',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: null,
      github_milestone_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });

    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ny',
        customer: 'Acme',
        responsible: 'Jonas',
        status: 'Planlagt',
      }),
    });
    expect(res.status).toBe(201);
    expect(vi.mocked(repo.createProject)).toHaveBeenCalledOnce();
  });

  it('GET /api/projects/:id returns 404 when missing', async () => {
    vi.mocked(repo.getProject).mockResolvedValue(undefined);
    const res = await app.request('/api/projects/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/projects/:id/board skips the GitHub call when not linked to a milestone', async () => {
    vi.mocked(repo.getProject).mockResolvedValue({
      id: 1,
      name: 'X',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: null,
      github_milestone_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });
    const res = await app.request('/api/projects/1/board');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ statusCounts: [], groups: [] });
    expect(githubSync.getMilestoneBoard).not.toHaveBeenCalled();
  });

  it('GET /api/projects/:id/board returns the github-sync result for a linked milestone', async () => {
    vi.mocked(repo.getProject).mockResolvedValue({
      id: 1,
      name: 'X',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: 'Prosjektmappe',
      github_milestone_number: 39,
      created_at: '2026-08-05T00:00:00Z',
    });
    const board = {
      statusCounts: [{ status: 'Backlog', count: 3 }],
      groups: [{ umbrella: null, total: 3, completed: 1, percentCompleted: 33, issues: [] }],
    };
    vi.mocked(githubSync.getMilestoneBoard).mockResolvedValue(board);
    const res = await app.request('/api/projects/1/board');
    expect(res.status).toBe(200);
    expect(githubSync.getMilestoneBoard).toHaveBeenCalledWith(39);
    expect(await res.json()).toEqual(board);
  });

  it('GET /api/projects passes the search/status query through to the repo', async () => {
    vi.mocked(repo.listProjects).mockResolvedValue([]);
    await app.request('/api/projects?team=OT&search=arbion&status=Pågår');
    expect(repo.listProjects).toHaveBeenCalledWith('OT', 'arbion', 'Pågår');
  });

  it('GET /api/team returns the repo result', async () => {
    vi.mocked(repo.listTeam).mockResolvedValue([{ owner: 'endsan', open_cases: 2, total_cases: 3 }]);
    const res = await app.request('/api/team');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ owner: 'endsan', open_cases: 2, total_cases: 3 }]);
  });

  it('GET /api/stats returns the repo result', async () => {
    const stats = {
      projectStatusCounts: [{ status: 'Pågår', count: 3 }],
      caseStatusCounts: [{ status: 'Åpen', count: 5 }],
      upcomingDeadlines: [],
      topOwners: [],
    };
    vi.mocked(repo.getDashboardStats).mockResolvedValue(stats);
    const res = await app.request('/api/stats');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(stats);
  });

  it('POST /api/projects pushes the new project to GitHub and links it back', async () => {
    vi.mocked(repo.createProject).mockResolvedValue({
      id: 7,
      name: 'Nytt kundeprosjekt',
      customer: 'Acme',
      status: 'Planlagt',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: '2026-12-01',
      challenges: 'Utfordring',
      github_repo: null,
      github_milestone_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });
    vi.mocked(githubSync.createGithubMilestone).mockResolvedValue({ number: 42 });
    vi.mocked(repo.setProjectGithubLink).mockResolvedValue({
      id: 7,
      name: 'Nytt kundeprosjekt',
      customer: 'Acme',
      status: 'Planlagt',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: '2026-12-01',
      challenges: 'Utfordring',
      github_repo: 'Prosjektmappe',
      github_milestone_number: 42,
      created_at: '2026-08-05T00:00:00Z',
    });

    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Nytt kundeprosjekt',
        customer: 'Acme',
        responsible: 'Jonas',
        status: 'Planlagt',
        end_date: '2026-12-01',
        challenges: 'Utfordring',
      }),
    });

    expect(res.status).toBe(201);
    expect(githubSync.createGithubMilestone).toHaveBeenCalledWith({
      title: 'Nytt kundeprosjekt',
      description: 'Utfordring',
      due_on: '2026-12-01',
    });
    expect(repo.setProjectGithubLink).toHaveBeenCalledWith(7, 'Prosjektmappe', 42);
    const body = await res.json();
    expect(body.github_milestone_number).toBe(42);
  });

  it('POST /api/projects links to an existing milestone instead of creating a new one', async () => {
    vi.mocked(repo.createProject).mockResolvedValue({
      id: 8,
      name: 'Eksisterende milestone',
      customer: 'Acme',
      status: 'Planlagt',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: null,
      github_milestone_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });
    vi.mocked(repo.setProjectGithubLink).mockResolvedValue({
      id: 8,
      name: 'Eksisterende milestone',
      customer: 'Acme',
      status: 'Planlagt',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: 'Prosjektmappe',
      github_milestone_number: 99,
      created_at: '2026-08-05T00:00:00Z',
    });

    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Eksisterende milestone',
        customer: 'Acme',
        responsible: 'Jonas',
        status: 'Planlagt',
        github_milestone_number: 99,
      }),
    });

    expect(res.status).toBe(201);
    expect(githubSync.createGithubMilestone).not.toHaveBeenCalled();
    expect(repo.setProjectGithubLink).toHaveBeenCalledWith(8, 'Prosjektmappe', 99);
    const body = await res.json();
    expect(body.github_milestone_number).toBe(99);
  });

  it('POST /api/projects/:id/cases passes the chosen owner through', async () => {
    vi.mocked(repo.getProject).mockResolvedValue({
      id: 1,
      name: 'X',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: null,
      github_milestone_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });
    vi.mocked(repo.createCase).mockResolvedValue({
      id: 1,
      project_id: 1,
      title: 'Ny sak',
      description: '',
      status: 'Åpen',
      case_date: null,
      owner: 'endsan',
      github_repo: null,
      github_issue_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });

    const res = await app.request('/api/projects/1/cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ny sak', owner: 'endsan' }),
    });

    expect(res.status).toBe(201);
    expect(repo.createCase).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ owner: 'endsan' }),
    );
  });

  it('POST /api/projects/:id/cases pushes the new case to GitHub as an issue and links it back', async () => {
    vi.mocked(repo.getProject).mockResolvedValue({
      id: 1,
      name: 'Kundeprosjekt',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Jonas',
      team: 'OT',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: 'Prosjektmappe',
      github_milestone_number: 42,
      created_at: '2026-08-05T00:00:00Z',
    });
    vi.mocked(repo.createCase).mockResolvedValue({
      id: 9,
      project_id: 1,
      title: 'Ny issue',
      description: 'Beskrivelse',
      status: 'Åpen',
      case_date: null,
      owner: 'endsan',
      github_repo: null,
      github_issue_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });
    vi.mocked(githubSync.createGithubIssue).mockResolvedValue({ number: 101 });
    vi.mocked(repo.setCaseGithubLink).mockResolvedValue({
      id: 9,
      project_id: 1,
      title: 'Ny issue',
      description: 'Beskrivelse',
      status: 'Åpen',
      case_date: null,
      owner: 'endsan',
      github_repo: 'Prosjektmappe',
      github_issue_number: 101,
      created_at: '2026-08-05T00:00:00Z',
    });

    const res = await app.request('/api/projects/1/cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Ny issue',
        description: 'Beskrivelse',
        owner: 'endsan',
        kunde: 'Acme',
        tjenesteparaply: 'Network',
      }),
    });

    expect(res.status).toBe(201);
    expect(githubSync.createGithubIssue).toHaveBeenCalledWith({
      title: 'Ny issue',
      description: 'Beskrivelse',
      status: 'Åpen',
      owner: 'endsan',
      frist: null,
      kunde: 'Acme',
      tjenesteparaply: 'Network',
      milestoneNumber: 42,
    });
    expect(repo.setCaseGithubLink).toHaveBeenCalledWith(1, 9, 'Prosjektmappe', 101);
    const body = await res.json();
    expect(body.github_issue_number).toBe(101);
  });

  it('POST /api/projects/:id/cases defaults Kunde to the project customer when not given', async () => {
    vi.mocked(repo.getProject).mockResolvedValue({
      id: 1,
      name: 'Kundeprosjekt',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Jonas',
      team: '',
      start_date: null,
      end_date: null,
      challenges: '',
      github_repo: null,
      github_milestone_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });
    vi.mocked(repo.createCase).mockResolvedValue({
      id: 2,
      project_id: 1,
      title: 'Ny issue',
      description: '',
      status: 'Åpen',
      case_date: null,
      owner: '',
      github_repo: null,
      github_issue_number: null,
      created_at: '2026-08-05T00:00:00Z',
    });

    await app.request('/api/projects/1/cases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ny issue' }),
    });

    expect(githubSync.createGithubIssue).toHaveBeenCalledWith(
      expect.objectContaining({ kunde: 'Acme' }),
    );
  });

  it('GET /api/cases passes project/owner filters through to the repo', async () => {
    vi.mocked(repo.listAllCases).mockResolvedValue([]);
    await app.request('/api/cases?project=3&owner=endsan');
    expect(repo.listAllCases).toHaveBeenCalledWith({ projectId: 3, owner: 'endsan' });
  });

  it('GET /api/customers returns the repo result', async () => {
    vi.mocked(repo.listCustomers).mockResolvedValue([
      { customer: 'Acme', project_count: 2, active_count: 1 },
    ]);
    const res = await app.request('/api/customers');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ customer: 'Acme', project_count: 2, active_count: 1 }]);
  });

  it('GET /api/prices returns the repo result', async () => {
    vi.mocked(repo.listPrices).mockResolvedValue([
      { id: 1, service: 'SRO', price: '1500.00', unit: 'per time', description: '', created_at: '2026-08-05T00:00:00Z' },
    ]);
    const res = await app.request('/api/prices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('POST /api/prices validates required fields', async () => {
    const res = await app.request('/api/prices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: '', price: 'not-a-number' }),
    });
    expect(res.status).toBe(400);
    expect(repo.createPrice).not.toHaveBeenCalled();
  });

  it('POST /api/prices creates a valid row', async () => {
    vi.mocked(repo.createPrice).mockResolvedValue({
      id: 1,
      service: 'SRO',
      price: '1500.00',
      unit: 'per time',
      description: '',
      created_at: '2026-08-05T00:00:00Z',
    });
    const res = await app.request('/api/prices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service: 'SRO', price: 1500, unit: 'per time' }),
    });
    expect(res.status).toBe(201);
    expect(repo.createPrice).toHaveBeenCalledWith({
      service: 'SRO',
      price: 1500,
      unit: 'per time',
      description: '',
    });
  });

  it('DELETE /api/prices/:id removes the row', async () => {
    const res = await app.request('/api/prices/1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(repo.deletePrice).toHaveBeenCalledWith(1);
  });

  it('GET /api/assignees returns the github-sync result', async () => {
    vi.mocked(githubSync.listActiveIssueOwners).mockResolvedValue([
      { login: 'endsan', avatar_url: 'https://example.com/a.png' },
    ]);
    const res = await app.request('/api/assignees');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ login: 'endsan', avatar_url: 'https://example.com/a.png' }]);
  });

  it('GET /api/repo-teams returns the github-sync result', async () => {
    vi.mocked(githubSync.listRepoTeams).mockResolvedValue([{ slug: 'network-ot', name: 'Network-OT' }]);
    const res = await app.request('/api/repo-teams');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ slug: 'network-ot', name: 'Network-OT' }]);
  });

  it('GET /api/repo-teams/:slug/members returns the github-sync result', async () => {
    vi.mocked(githubSync.listTeamMembers).mockResolvedValue([
      { login: 'endsan', avatar_url: 'https://example.com/a.png' },
    ]);
    const res = await app.request('/api/repo-teams/network-ot/members');
    expect(res.status).toBe(200);
    expect(githubSync.listTeamMembers).toHaveBeenCalledWith('network-ot');
    expect(await res.json()).toEqual([{ login: 'endsan', avatar_url: 'https://example.com/a.png' }]);
  });

  it('GET /api/pull-requests returns the github-sync result', async () => {
    vi.mocked(githubSync.listOpenPullRequests).mockResolvedValue([
      { number: 12, title: 'Fiks synk', html_url: 'https://github.com/intility/Prosjektmappe/pull/12', draft: false },
    ]);
    const res = await app.request('/api/pull-requests');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { number: 12, title: 'Fiks synk', html_url: 'https://github.com/intility/Prosjektmappe/pull/12', draft: false },
    ]);
  });

  it('GET /api/pull-requests returns the github-sync result', async () => {
    vi.mocked(githubSync.listOpenPullRequests).mockResolvedValue([
      { number: 12, title: 'Fix noe', html_url: 'https://github.com/x/y/pull/12', draft: false },
    ]);
    const res = await app.request('/api/pull-requests');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { number: 12, title: 'Fix noe', html_url: 'https://github.com/x/y/pull/12', draft: false },
    ]);
  });

  it('unknown /api routes return JSON 404', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('POST /api/webhooks/github rejects an unverified signature without syncing', async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    vi.mocked(githubSync.verifyGithubWebhookSignature).mockReturnValue(false);

    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-github-event': 'issues' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(404);
    expect(githubSync.syncGithubProjects).not.toHaveBeenCalled();
  });

  it('POST /api/webhooks/github triggers an immediate sync for a verified issues event', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    vi.mocked(githubSync.verifyGithubWebhookSignature).mockReturnValue(true);

    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'issues',
        'x-hub-signature-256': 'sha256=whatever',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(202);
    expect(githubSync.syncGithubProjects).toHaveBeenCalledTimes(1);
  });

  it('POST /api/webhooks/github does not sync for an unrelated verified event', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    vi.mocked(githubSync.verifyGithubWebhookSignature).mockReturnValue(true);

    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'star',
        'x-hub-signature-256': 'sha256=whatever',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(202);
    expect(githubSync.syncGithubProjects).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hei' }] }),
    });
    expect(res.status).toBe(503);
  });

  it('returns 400 for an empty message list', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(400);
  });
});
