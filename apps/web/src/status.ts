type BadgeState = 'default' | 'neutral' | 'brand' | 'chill' | 'attn' | 'success' | 'warning' | 'alert';

const PROJECT_BADGE: Record<string, BadgeState> = {
  Planlagt: 'neutral',
  Pågår: 'chill',
  Forsinket: 'warning',
  Fullført: 'success',
};

const CASE_BADGE: Record<string, BadgeState> = {
  Åpen: 'neutral',
  'Under arbeid': 'chill',
  Løst: 'success',
};

export function projectBadgeState(status: string): BadgeState {
  return PROJECT_BADGE[status] ?? 'default';
}

export function caseBadgeState(status: string): BadgeState {
  return CASE_BADGE[status] ?? 'default';
}

const BADGE_STATE_COLOR: Record<BadgeState, string> = {
  default: 'hsl(var(--bfc-neutral-hsl))',
  neutral: 'hsl(var(--bfc-neutral-hsl))',
  brand: 'hsl(var(--bfc-brand-hsl))',
  chill: 'hsl(var(--bfc-chill-hsl))',
  attn: 'hsl(var(--bfc-attn-hsl))',
  success: 'hsl(var(--bfc-success-hsl))',
  warning: 'hsl(var(--bfc-warning-hsl))',
  alert: 'hsl(var(--bfc-alert-hsl))',
};

// Reuse the same reserved status palette as the badges, so a chart bar for
// "Forsinket" is drawn in the exact color as the "Forsinket" badge elsewhere.
export function projectStatusColor(status: string): string {
  return BADGE_STATE_COLOR[projectBadgeState(status)];
}

export function caseStatusColor(status: string): string {
  return BADGE_STATE_COLOR[caseBadgeState(status)];
}

export function formatDate(value: string | null): string {
  if (!value) return '–';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return date.toLocaleDateString('nb-NO', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTimeline(start: string | null, end: string | null): string {
  if (!start && !end) return '–';
  return `${formatDate(start)} – ${formatDate(end)}`;
}

// The org is fixed for this deployment (see GITHUB_ORG on the server, default
// "intility") — there's no per-request way for the frontend to know it, so it's
// hardcoded here to match.
const GITHUB_ORG = 'intility';

export function githubIssueUrl(repo: string, issueNumber: number): string {
  return `https://github.com/${GITHUB_ORG}/${repo}/issues/${issueNumber}`;
}

export function daysUntil(date: string): number {
  const ms = new Date(date).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
