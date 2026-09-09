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

  it('uses the "### Frist" field from the issue body as case_date, not created_at', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ number: 9, title: 'Med frist', description: null, state: 'open', due_on: null }]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 70,
            title: 'Har en frist satt',
            body: '### Frist\n\n2026-12-24\n\n### Kunde\n\nAcme',
            state: 'open',
            created_at: '2026-08-01T00:00:00Z',
            milestone: { number: 9 },
            assignees: [],
          },
          {
            number: 71,
            title: 'Ingen frist satt',
            body: '### Kunde\n\nAcme',
            state: 'open',
            created_at: '2026-08-02T00:00:00Z',
            milestone: { number: 9 },
            assignees: [],
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(repo.getProjectIdByGithubMilestone).mockResolvedValue(11);

    await syncGithubProjects();

    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenNthCalledWith(
      1,
      11,
      expect.objectContaining({ case_date: '2026-12-24' }),
    );
    expect(vi.mocked(repo.upsertCaseFromGithub)).toHaveBeenNthCalledWith(
      2,
      11,
      expect.objectContaining({ case_date: '2026-08-02' }),
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

// The Status field's id/option ids are cached for the module's lifetime (see
// the comment on statusFieldMetaCache in github-sync.ts), so each of these
// tests resets the module registry and re-imports fresh - otherwise a cache
// populated by an earlier test would silently skip the field-meta fetch in a
// later one and throw off its expected call count.
describe('project board status sync', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_ORG = 'intility';
    process.env.GITHUB_REPO = 'Prosjektmappe';
    delete process.env.PROJECT_TOKEN;
  });

  it('listStatusOptions returns an empty list without PROJECT_TOKEN', async () => {
    const { listStatusOptions } = await import('./github-sync.js');
    expect(await listStatusOptions()).toEqual([]);
  });

  it("listStatusOptions returns the Status field's option names in order", async () => {
    process.env.PROJECT_TOKEN = 'proj-token';
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          organization: {
            projectV2: {
              id: 'PVT_1',
              field: {
                id: 'PVTSSF_1',
                options: [
                  { id: 'opt-backlog', name: 'Backlog' },
                  { id: 'opt-todo', name: 'To do' },
                  { id: 'opt-progress', name: 'In progress' },
                  { id: 'opt-blocked', name: 'Blocked' },
                  { id: 'opt-done', name: 'Done' },
                ],
              },
            },
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { listStatusOptions } = await import('./github-sync.js');

    expect(await listStatusOptions()).toEqual(['Backlog', 'To do', 'In progress', 'Blocked', 'Done']);
  });

  it('moveIssueStatus fails without PROJECT_TOKEN', async () => {
    const { moveIssueStatus } = await import('./github-sync.js');
    expect(await moveIssueStatus(42, 'Done')).toEqual({ ok: false, error: 'PROJECT_TOKEN er ikke satt opp.' });
  });

  it('moveIssueStatus resolves the field and item ids, then mutates the project field', async () => {
    process.env.PROJECT_TOKEN = 'proj-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            organization: {
              projectV2: { id: 'PVT_1', field: { id: 'PVTSSF_1', options: [{ id: 'opt-done', name: 'Done' }] } },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            repository: {
              issue: { projectItems: { nodes: [{ id: 'PVTI_1', project: { number: 318 } }] } },
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { updateProjectV2ItemFieldValue: { clientMutationId: null } } }));
    vi.stubGlobal('fetch', fetchMock);

    const { moveIssueStatus } = await import('./github-sync.js');
    const result = await moveIssueStatus(42, 'Done');

    expect(result).toEqual({ ok: true, status: 'Done' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const mutationBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(mutationBody.variables).toEqual({
      project: 'PVT_1',
      item: 'PVTI_1',
      field: 'PVTSSF_1',
      option: 'opt-done',
    });
  });

  it('moveIssueStatus fails when the status name is not one of the field\'s options', async () => {
    process.env.PROJECT_TOKEN = 'proj-token';
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          organization: {
            projectV2: { id: 'PVT_1', field: { id: 'PVTSSF_1', options: [{ id: 'opt-done', name: 'Done' }] } },
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { moveIssueStatus } = await import('./github-sync.js');

    expect(await moveIssueStatus(42, 'Nonexistent')).toEqual({ ok: false, error: 'Ukjent status: Nonexistent' });
  });

  it('moveIssueStatus fails when the issue has no item on this project board', async () => {
    process.env.PROJECT_TOKEN = 'proj-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            organization: {
              projectV2: { id: 'PVT_1', field: { id: 'PVTSSF_1', options: [{ id: 'opt-done', name: 'Done' }] } },
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { repository: { issue: { projectItems: { nodes: [] } } } } }));
    vi.stubGlobal('fetch', fetchMock);

    const { moveIssueStatus } = await import('./github-sync.js');

    expect(await moveIssueStatus(42, 'Done')).toEqual({
      ok: false,
      error: 'Fant ikke issue #42 på GitHub-prosjekttavlen.',
    });
  });
});
