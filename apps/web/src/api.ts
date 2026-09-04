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
  github_repo: string | null;
  github_milestone_number: number | null;
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
  owner: string;
  github_repo: string | null;
  github_issue_number: number | null;
  created_at: string;
}

export interface TeamMember {
  owner: string;
  open_cases: number;
  total_cases: number;
}

export interface CaseWithProjectInfo extends Case {
  project_name: string;
  customer: string;
}

export interface Assignee {
  login: string;
  avatar_url: string;
}

export interface ServiceUmbrella {
  number: number;
  title: string;
}

export interface OpenMilestone {
  number: number;
  title: string;
  due_on: string | null;
  description: string | null;
}

export interface Customer {
  customer: string;
  project_count: number;
  active_count: number;
}

export interface Price {
  id: number;
  service: string;
  price: string;
  unit: string;
  description: string;
  created_at: string;
}

export interface PriceInput {
  service: string;
  price: number;
  unit?: string;
  description?: string;
}

export interface ActivityItem {
  type: 'project' | 'case';
  id: number;
  title: string;
  project_id: number | null;
  project_name: string | null;
  github_repo: string | null;
  github_number: number | null;
  created_at: string;
}

export interface DashboardStats {
  projectStatusCounts: { status: string; count: number }[];
  caseStatusCounts: { status: string; count: number }[];
  upcomingDeadlines: { id: number; name: string; customer: string; end_date: string }[];
  topOwners: TeamMember[];
  recentActivity: ActivityItem[];
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
  owner?: string;
  kunde?: string;
  tjenesteparaply?: string;
}

export interface Meta {
  projectStatuses: string[];
  caseStatuses: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  listProjects: (team?: string, search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (team) params.set('team', team);
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const query = params.toString();
    return request<ProjectWithCount[]>(`/api/projects${query ? `?${query}` : ''}`);
  },
  listTeams: () => request<string[]>('/api/teams'),
  listTeam: () => request<TeamMember[]>('/api/team'),
  listAssignees: () => request<Assignee[]>('/api/assignees'),
  listCustomerOptions: () => request<string[]>('/api/customer-options'),
  listServiceUmbrellas: () => request<ServiceUmbrella[]>('/api/service-umbrellas'),
  listOpenMilestones: () => request<OpenMilestone[]>('/api/milestones'),
  getStats: () => request<DashboardStats>('/api/stats'),
  listCases: (filters: { projectId?: number; owner?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set('project', String(filters.projectId));
    if (filters.owner) params.set('owner', filters.owner);
    const query = params.toString();
    return request<CaseWithProjectInfo[]>(`/api/cases${query ? `?${query}` : ''}`);
  },
  listCustomers: () => request<Customer[]>('/api/customers'),
  listPrices: () => request<Price[]>('/api/prices'),
  createPrice: (data: PriceInput) =>
    request<Price>('/api/prices', { method: 'POST', body: JSON.stringify(data) }),
  updatePrice: (id: number, data: PriceInput) =>
    request<Price>(`/api/prices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrice: (id: number) => request<void>(`/api/prices/${id}`, { method: 'DELETE' }),
  getProject: (id: number) => request<{ project: Project; cases: Case[] }>(`/api/projects/${id}`),
  createProject: (data: ProjectInput, existingMilestoneNumber?: number) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(
        existingMilestoneNumber ? { ...data, github_milestone_number: existingMilestoneNumber } : data,
      ),
    }),
  updateProject: (id: number, data: ProjectInput) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  createCase: (projectId: number, data: CaseInput) =>
    request<Case>(`/api/projects/${projectId}/cases`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCase: (projectId: number, caseId: number) =>
    request<void>(`/api/projects/${projectId}/cases/${caseId}`, { method: 'DELETE' }),
  // Streams the assistant's reply as plain text chunks via `onChunk`, resolving
  // once the stream ends. Not routed through `request()`: this is a text stream,
  // not a single JSON body.
  streamChat: async (messages: ChatMessage[], onChunk: (text: string) => void): Promise<void> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok || !res.body) {
      let message = `Forespørselen feilet (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore non-JSON error bodies
      }
      throw new Error(message);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  },
};
