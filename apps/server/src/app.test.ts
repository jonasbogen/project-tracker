import { describe, expect, it, vi, beforeEach } from 'vitest';
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
    listTeam: vi.fn(),
    listActiveCasesByOwner: vi.fn(),
    getDashboardStats: vi.fn(),
  };
});

// Keeps this suite hermetic: no test here should ever reach the real GitHub API.
vi.mock('./github-sync.js', () => ({
  createGithubMilestone: vi.fn().mockResolvedValue(null),
  listGithubAssignees: vi.fn().mockResolvedValue([]),
  githubRepoName: vi.fn().mockReturnValue('Prosjektmappe'),
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

  it('GET /api/projects passes the search query through to the repo', async () => {
    vi.mocked(repo.listProjects).mockResolvedValue([]);
    await app.request('/api/projects?team=OT&search=arbion');
    expect(repo.listProjects).toHaveBeenCalledWith('OT', 'arbion');
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

  it('GET /api/team/:owner/cases returns the repo result', async () => {
    vi.mocked(repo.listActiveCasesByOwner).mockResolvedValue([]);
    const res = await app.request('/api/team/endsan/cases');
    expect(res.status).toBe(200);
    expect(repo.listActiveCasesByOwner).toHaveBeenCalledWith('endsan');
  });

  it('GET /api/assignees returns the github-sync result', async () => {
    vi.mocked(githubSync.listGithubAssignees).mockResolvedValue([
      { login: 'endsan', avatar_url: 'https://example.com/a.png' },
    ]);
    const res = await app.request('/api/assignees');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ login: 'endsan', avatar_url: 'https://example.com/a.png' }]);
  });

  it('unknown /api routes return JSON 404', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
