import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as repo from './repo.js';

vi.mock('./repo.js', async (importActual) => {
  const actual = await importActual<typeof import('./repo.js')>();
  return { ...actual, upsertProjectFromGithub: vi.fn() };
});

const { syncGithubProjects } = await import('./github-sync.js');

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_ORG = 'intility';
});

describe('syncGithubProjects', () => {
  it('only syncs repos whose name contains "ot", and maps milestone state to status', async () => {
    const fetchMock = vi
      .fn()
      // page 1 of org repos
      .mockResolvedValueOnce(
        jsonResponse([
          { name: 'ot-portal' },
          { name: 'unrelated-repo' },
          { name: 'iot-gateway' }, // contains "ot" as a substring, not just as a standalone word
        ]),
      )
      // milestones for ot-portal
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 1,
            title: 'Rollout fase 1',
            description: 'Beskrivelse',
            state: 'closed',
            due_on: '2020-01-01T00:00:00Z',
            creator: { login: 'alice' },
          },
          {
            number: 2,
            title: 'Rollout fase 2',
            description: null,
            state: 'open',
            due_on: '2000-01-01T00:00:00Z', // in the past -> overdue
            creator: null,
          },
        ]),
      )
      // milestones for iot-gateway
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 3,
            title: 'Fremtidig',
            description: null,
            state: 'open',
            due_on: '2999-01-01T00:00:00Z',
            creator: null,
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncGithubProjects();

    expect(result).toEqual({ repos: 2, milestones: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenNthCalledWith(1, {
      name: 'Rollout fase 1',
      customer: 'ot-portal',
      status: 'Fullført',
      responsible: 'alice',
      end_date: '2020-01-01',
      challenges: 'Beskrivelse',
      github_repo: 'ot-portal',
      github_milestone_number: 1,
    });
    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenNthCalledWith(2, {
      name: 'Rollout fase 2',
      customer: 'ot-portal',
      status: 'Forsinket',
      responsible: '',
      end_date: '2000-01-01',
      challenges: '',
      github_repo: 'ot-portal',
      github_milestone_number: 2,
    });
    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenNthCalledWith(3, {
      name: 'Fremtidig',
      customer: 'iot-gateway',
      status: 'Pågår',
      responsible: '',
      end_date: '2999-01-01',
      challenges: '',
      github_repo: 'iot-gateway',
      github_milestone_number: 3,
    });
  });

  it('keeps syncing other repos when one repo fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ name: 'ot-a' }, { name: 'ot-b' }]))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 1,
            title: 'OK',
            description: '',
            state: 'open',
            due_on: null,
            creator: null,
          },
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncGithubProjects();

    expect(result).toEqual({ repos: 2, milestones: 1 });
    expect(vi.mocked(repo.upsertProjectFromGithub)).toHaveBeenCalledTimes(1);
  });
});
