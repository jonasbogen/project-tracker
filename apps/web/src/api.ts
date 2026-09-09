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

export interface RepoTeam {
  slug: string;
  name: string;
}

export interface RepoLabel {
  name: string;
  color: string;
}

export interface RecentPullRequest {
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  user: string;
}

export interface RecentPullRequestsResult {
  pulls: RecentPullRequest[];
  error: string | null;
}

export interface WeeklyReport {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  body: string;
  openCaseCount: number;
}

export interface WeeklyReportsResult {
  reports: WeeklyReport[];
  error: string | null;
}

export interface StatusdeckRun {
  id: number;
  created_at: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  artifactExpired: boolean | null;
}

export interface StatusdeckRunsResult {
  runs: StatusdeckRun[];
  error: string | null;
}

export interface MilestoneBoardIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  assignees: Assignee[];
  status: string | null;
}

export interface MilestoneBoardGroup {
  umbrella: { number: number; title: string; html_url: string } | null;
  total: number;
  completed: number;
  percentCompleted: number;
  issues: MilestoneBoardIssue[];
}

export interface MilestoneBoard {
  statusCounts: { status: string; count: number }[];
  groups: MilestoneBoardGroup[];
  statusOrder: string[];
}

export interface Customer {
  customer: string;
  project_count: number;
  active_count: number;
}

export interface PriceTier {
  id: number;
  price_id: number;
  tier_label: string;
  price: string | null;
  sort_order: number;
}

export interface Price {
  id: number;
  category_id: number;
  service: string;
  type: string;
  description: string;
  pricing_model: string;
  billing: string;
  unit: string;
  price: string | null;
  leasing_price: string | null;
  sort_order: number;
  created_at: string;
  tiers: PriceTier[];
}

export interface PriceCategory {
  id: number;
  name: string;
  sort_order: number;
  prices: Price[];
}

export interface PriceTierInput {
  tier_label: string;
  price: number | null;
}

export interface PriceInput {
  category_id: number;
  service: string;
  type: string;
  description?: string;
  pricing_model: string;
  billing: string;
  unit?: string;
  price?: number | null;
  leasing_price?: number | null;
  tiers?: PriceTierInput[];
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
  updated_at: string;
}

export interface WeeklyTrendPoint {
  weekStart: string;
  resolved: number;
}

export interface DashboardStats {
  projectStatusCounts: { status: string; count: number }[];
  caseStatusCounts: { status: string; count: number }[];
  upcomingDeadlines: CalendarItem[];
  topOwners: TeamMember[];
  recentActivity: ActivityItem[];
  weeklyTrend: WeeklyTrendPoint[];
}

export interface BlockedIssue {
  number: number;
  title: string;
  blockedByOwners: string[];
  project_id: number | null;
  project_name: string | null;
}

export interface BlockedIssuesResult {
  items: BlockedIssue[];
  error: string | null;
}

export interface CalendarItem {
  type: 'project' | 'case';
  id: number;
  project_id: number;
  title: string;
  customer: string;
  date: string;
  github_repo: string | null;
  github_number: number | null;
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
  label?: string;
}

export interface Meta {
  projectStatuses: string[];
  caseStatuses: string[];
  offerStatuses: string[];
}

export interface Offer {
  id: number;
  customer: string;
  project_id: number | null;
  project_name: string | null;
  title: string;
  description: string;
  amount: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OfferInput {
  customer: string;
  project_id?: number | null;
  title: string;
  description?: string;
  amount: number;
  status?: string;
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
  listProjects: (team?: string, search?: string, status?: string, customer?: string) => {
    const params = new URLSearchParams();
    if (team) params.set('team', team);
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (customer) params.set('customer', customer);
    const query = params.toString();
    return request<ProjectWithCount[]>(`/api/projects${query ? `?${query}` : ''}`);
  },
  listTeams: () => request<string[]>('/api/teams'),
  listTeam: () => request<TeamMember[]>('/api/team'),
  listAssignees: () => request<Assignee[]>('/api/assignees'),
  listCustomerOptions: () => request<string[]>('/api/customer-options'),
  listServiceUmbrellas: () => request<ServiceUmbrella[]>('/api/service-umbrellas'),
  listOpenMilestones: () => request<OpenMilestone[]>('/api/milestones'),
  listRepoTeams: () => request<RepoTeam[]>('/api/repo-teams'),
  listRepoLabels: () => request<RepoLabel[]>('/api/repo-labels'),
  listTeamMembers: (slug: string) => request<Assignee[]>(`/api/repo-teams/${encodeURIComponent(slug)}/members`),
  listRecentPullRequests: () => request<RecentPullRequestsResult>('/api/pull-requests'),
  listWeeklyReports: () => request<WeeklyReportsResult>('/api/reports/weekly'),
  listStatusdeckRuns: () => request<StatusdeckRunsResult>('/api/reports/statusdeck'),
  listBlocked: () => request<BlockedIssuesResult>('/api/blocked'),
  listCalendar: () => request<CalendarItem[]>('/api/calendar'),
  getStats: () => request<DashboardStats>('/api/stats'),
  listCases: (filters: { projectId?: number; owner?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set('project', String(filters.projectId));
    if (filters.owner) params.set('owner', filters.owner);
    const query = params.toString();
    return request<CaseWithProjectInfo[]>(`/api/cases${query ? `?${query}` : ''}`);
  },
  listCustomers: () => request<Customer[]>('/api/customers'),
  listPriceCategories: () => request<PriceCategory[]>('/api/price-categories'),
  createPriceCategory: (name: string) =>
    request<PriceCategory>('/api/price-categories', { method: 'POST', body: JSON.stringify({ name }) }),
  renamePriceCategory: (id: number, name: string) =>
    request<void>(`/api/price-categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deletePriceCategory: (id: number) =>
    request<void>(`/api/price-categories/${id}`, { method: 'DELETE' }),
  createPrice: (data: PriceInput) =>
    request<Price>('/api/prices', { method: 'POST', body: JSON.stringify(data) }),
  updatePrice: (id: number, data: PriceInput) =>
    request<Price>(`/api/prices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePrice: (id: number) => request<void>(`/api/prices/${id}`, { method: 'DELETE' }),
  getProject: (id: number) => request<{ project: Project; cases: Case[] }>(`/api/projects/${id}`),
  getProjectBoard: (id: number) => request<MilestoneBoard>(`/api/projects/${id}/board`),
  moveBoardCard: (id: number, issueNumber: number, status: string) =>
    request<{ status: string }>(`/api/projects/${id}/board`, {
      method: 'PATCH',
      body: JSON.stringify({ issueNumber, status }),
    }),
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
  listOffers: () => request<Offer[]>('/api/offers'),
  createOffer: (data: OfferInput) =>
    request<Offer>('/api/offers', { method: 'POST', body: JSON.stringify(data) }),
  updateOffer: (id: number, data: OfferInput) =>
    request<Offer>(`/api/offers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOffer: (id: number) => request<void>(`/api/offers/${id}`, { method: 'DELETE' }),
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
