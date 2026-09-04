import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as repo from './repo.js';

vi.mock('./repo.js', async (importActual) => {
  const actual = await importActual<typeof import('./repo.js')>();
  return {
    ...actual,
    upsertProjectFromGithub: vi.fn(),
    getProjectIdByGithubMilestone: vi.fn(),
    upsertCaseFromGithub: vi.fn(),
  };
});

const { syncGithubProjects } = await import('./github-sync.js');

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_ORG = 'intility';
  process.env.GITHUB_REPO = 'Prosjektmappe';
});

describe('syncGithubProjects', () => {
  it('turns milestones into projects and milestone-linked issues into cases', async () => {
    const fetchMock = vi
      .fn()
      // milestones (fewer than 100 -> single page)
      .mockResolvedValueOnce(
        jsonResponse([
          { number: 1, title: 'Arbion – Del 2', description: 'frist 30. nov', state: 'open', due_on: '2026-11-30T00:00:00Z' },
        ]),
      )
      // issues (fewer than 100 -> single page)
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 36,
            title: 'Installer og konfigurer switcher',
            body: '### Prosjekt (milestone)\n\nArbion – Del 2\n\n### Kunde\n\nArbion\n\n### Beskrivelse\n\nBytt ut gammelt utstyr',
            state: 'open',
            created_at: '2026-08-01T00:00:00Z',
            milestone: { number: 1 },
          },
          {
            number: 37,
            title: 'En pull request',
            body: null,
            state: 'open',
            created_at: '2026-08-02T00:00:00Z',
            milestone: { number: 1 },
            pull_request: {},
          },
          {
            number: 38,
            title: 'Uten milestone',
            body: null,
            state: 'open',
            created_at: '2026-08-03T00:00:00Z',
            milestone: null,
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(repo.getProjectIdByGithubMilestone).mockResolvedValue(42);

    const result = await syncGithubProjects();

    expect(result).toEqual({ projects: 1, cases: 1 });
    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenCalledWith({
      name: 'Arbion – Del 2',
      customer: 'Arbion',
      status: 'Pågår',
      responsible: '',
      end_date: '2026-11-30',
      challenges: 'frist 30. nov',
      github_repo: 'Prosjektmappe',
      github_milestone_number: 1,
    });
    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenCalledWith(42, {
      title: 'Installer og konfigurer switcher',
      description: 'Bytt ut gammelt utstyr',
      status: 'Åpen',
      case_date: '2026-08-01',
      github_repo: 'Prosjektmappe',
      github_issue_number: 36,
    });
  });

  it('falls back to the milestone title as customer when no issue has a "Kunde" field', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ number: 2, title: 'Mustad prosjekt', description: null, state: 'closed', due_on: null }]),
      )
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await syncGithubProjects();

    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'Mustad prosjekt', status: 'Fullført' }),
    );
  });

  it('skips a case sync it cannot resolve back to a project without failing the whole run', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 1,
            title: 'Orphaned',
            body: null,
            state: 'open',
            created_at: '2026-08-01T00:00:00Z',
            milestone: { number: 99 },
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(repo.getProjectIdByGithubMilestone).mockResolvedValue(undefined);

    const result = await syncGithubProjects();

    expect(result).toEqual({ projects: 0, cases: 0 });
    expect(vi.mocked(repo.upsertCaseFromGithub)).not.toHaveBeenCalled();
  });
});
