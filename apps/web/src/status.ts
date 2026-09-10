export type BadgeState = 'default' | 'neutral' | 'brand' | 'chill' | 'attn' | 'success' | 'warning' | 'alert';

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

const OFFER_BADGE: Record<string, BadgeState> = {
  'Sendt tilbud': 'neutral',
  Godkjent: 'chill',
  Levert: 'attn',
  Fakturert: 'success',
};

// The org's GitHub Projects V2 Status field options (see MilestoneBoard) -
// a different axis from the app's own case/project status, so its own map.
const BOARD_BADGE: Record<string, BadgeState> = {
  Backlog: 'neutral',
  'To do': 'chill',
  'In progress': 'attn',
  Blocked: 'alert',
  Done: 'success',
};

export function boardStatusBadgeState(status: string): BadgeState {
  return BOARD_BADGE[status] ?? 'default';
}

export function projectBadgeState(status: string): BadgeState {
  return PROJECT_BADGE[status] ?? 'default';
}

export function caseBadgeState(status: string): BadgeState {
  return CASE_BADGE[status] ?? 'default';
}

export function offerBadgeState(status: string): BadgeState {
  return OFFER_BADGE[status] ?? 'default';
}

export function formatAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return `${n.toLocaleString('nb-NO')} kr`;
}

// Bifrost's own badge pills use its "fade" tokens (a pale tint + dark text),
// which already read as calm. But the accents this app draws directly with
// these colors - stat-tile top borders, board-column top borders, chart bars
// - use the *raw*, ~100%-saturated brand tokens (e.g. --bfc-warning-hsl is a
// pure, traffic-sign yellow), which reads as loud precisely because those
// are large, solid color surfaces instead of small pills. This is a
// deliberately muted, same-family-feeling palette for exactly those large
// surfaces - similar saturation/lightness across every state so they read as
// one coherent set rather than each being its own fully-saturated hue.
const BADGE_STATE_COLOR: Record<BadgeState, string> = {
  default: 'hsl(220, 9%, 46%)',
  neutral: 'hsl(220, 9%, 46%)',
  brand: 'hsl(174, 45%, 36%)',
  chill: 'hsl(212, 40%, 50%)',
  attn: 'hsl(324, 30%, 52%)',
  success: 'hsl(152, 40%, 38%)',
  warning: 'hsl(36, 55%, 46%)',
  alert: 'hsl(4, 55%, 48%)',
};

// The one place any accent color (a stat tile's top border, a bar in a
// chart, a board column's top border) is picked, so the whole app draws
// from the exact same muted palette instead of each spot re-deriving its
// own shade of "warning" or "chill".
export function accentColor(state: BadgeState): string {
  return BADGE_STATE_COLOR[state];
}

// Reuse the same reserved status palette as the badges, so a chart bar for
// "Forsinket" is drawn in the exact color as the "Forsinket" badge elsewhere.
export function projectStatusColor(status: string): string {
  return BADGE_STATE_COLOR[projectBadgeState(status)];
}

export function caseStatusColor(status: string): string {
  return BADGE_STATE_COLOR[caseBadgeState(status)];
}

export function boardStatusColor(status: string): string {
  return BADGE_STATE_COLOR[boardStatusBadgeState(status)];
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

export function githubMilestoneUrl(repo: string, milestoneNumber: number): string {
  return `https://github.com/${GITHUB_ORG}/${repo}/milestone/${milestoneNumber}`;
}

// Coarse relative time ("nå", "3t siden", "5d siden") for the activity feed — falls
// back to a plain date once it's more than a week old, where "X uker siden" stops
// being more useful than the date itself.
export function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '–';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'nå';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d siden`;
  return formatDate(value);
}

export function daysUntil(date: string): number {
  const ms = new Date(date).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ISO week number, matching the exact algorithm the repo's own Ukesrapport/
// Statusdeck workflows use, so "Uke 34" on the dashboard always means the same
// week as "Ukesrapport – uke 34" on GitHub.
export function isoWeekNumber(date: string): number {
  const d = new Date(date);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7));
}
