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
