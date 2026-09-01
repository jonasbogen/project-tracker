import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createApp } from './app.js';
import * as repo from './repo.js';

vi.mock('./repo.js', async (importActual) => {
  const actual = await importActual<typeof import('./repo.js')>();
  return {
    ...actual,
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    listCases: vi.fn(),
    createCase: vi.fn(),
  };
});

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

  it('unknown /api routes return JSON 404', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
