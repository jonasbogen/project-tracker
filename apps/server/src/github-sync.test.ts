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
          {
            number: 1,
            title: 'Arbion – Del 2',
            description: 'frist 30. nov',
            state: 'open',
            due_on: '2026-11-30T00:00:00Z',
            updated_at: '2026-08-10T00:00:00Z',
          },
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
            updated_at: '2026-08-05T00:00:00Z',
            milestone: { number: 1 },
            assignees: [{ login: 'endsan' }],
          },
          {
            number: 37,
            title: 'En pull request',
            body: null,
            state: 'open',
            created_at: '2026-08-02T00:00:00Z',
            milestone: { number: 1 },
            assignees: [],
            pull_request: {},
          },
          {
            number: 38,
            title: 'Uten milestone',
            body: null,
            state: 'open',
            created_at: '2026-08-03T00:00:00Z',
            milestone: null,
            assignees: [],
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
      github_updated_at: '2026-08-10T00:00:00Z',
    });
    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenCalledWith(42, {
      title: 'Installer og konfigurer switcher',
      description: 'Bytt ut gammelt utstyr',
      status: 'Åpen',
      case_date: '2026-08-01',
      owner: 'endsan',
      github_repo: 'Prosjektmappe',
      github_issue_number: 36,
      github_updated_at: '2026-08-05T00:00:00Z',
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

  it('never dumps the raw template body as description when "Beskrivelse" is missing, but keeps plain freeform bodies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ number: 5, title: 'Test prosjekt', description: null, state: 'open', due_on: null }]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 60,
            title: 'Uten Beskrivelse-felt',
            body: '### Prosjekt (milestone)\n\nTest prosjekt\n\n### Kunde\n\nAcme',
            state: 'open',
            created_at: '2026-08-01T00:00:00Z',
            milestone: { number: 5 },
            assignees: [],
          },
          {
            number: 61,
            title: 'Fritekst-issue',
            body: 'Bare litt vanlig tekst, ingen mal her.',
            state: 'open',
            created_at: '2026-08-02T00:00:00Z',
            milestone: { number: 5 },
            assignees: [],
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(repo.getProjectIdByGithubMilestone).mockResolvedValue(7);

    await syncGithubProjects();

    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenNthCalledWith(
      1,
      7,
      expect.objectContaining({ description: '' }),
    );
    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenNthCalledWith(
      2,
      7,
      expect.objectContaining({ description: 'Bare litt vanlig tekst, ingen mal her.' }),
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
            assignees: [],
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
