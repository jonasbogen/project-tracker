export interface Project {
  id: number;
  name: string;
  customer: string;
  status: string;
  responsible: string;
  team: string;
  start_date: string | null;
  end_date: string | null;
  challenges: string;
  created_at: string;
}

export interface ProjectWithCount extends Project {
  case_count: number;
}

export interface Case {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: string;
  case_date: string | null;
  created_at: string;
}

export interface ProjectInput {
  name: string;
  customer: string;
  status: string;
  responsible: string;
  team?: string;
  start_date?: string | null;
  end_date?: string | null;
  challenges?: string;
}

export interface CaseInput {
  title: string;
  description?: string;
  status?: string;
  case_date?: string | null;
}

export interface Meta {
  projectStatuses: string[];
  caseStatuses: string[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    let message = `Forespørselen feilet (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getMeta: () => request<Meta>('/api/meta'),
  listProjects: (team?: string) =>
    request<ProjectWithCount[]>(`/api/projects${team ? `?team=${encodeURIComponent(team)}` : ''}`),
  listTeams: () => request<string[]>('/api/teams'),
  getProject: (id: number) => request<{ project: Project; cases: Case[] }>(`/api/projects/${id}`),
  createProject: (data: ProjectInput) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: ProjectInput) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  createCase: (projectId: number, data: CaseInput) =>
    request<Case>(`/api/projects/${projectId}/cases`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCase: (projectId: number, caseId: number) =>
    request<void>(`/api/projects/${projectId}/cases/${caseId}`, { method: 'DELETE' }),
};
