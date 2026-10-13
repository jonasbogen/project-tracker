import type { Team } from '../game/types';

/** Icons a team can pick as its mark, served from public/icons. */
export const TEAM_ICONS = ['finans', 'build', 'roadmap', 'handel'] as const;
export type TeamIcon = (typeof TEAM_ICONS)[number];

export function iconSrc(icon: string): string {
  return `/icons/${icon}.svg`;
}

/**
 * A team's mark: its icon when it has one, otherwise the emoji from older
 * saves. Sized in em so it follows the surrounding text.
 */
export function TeamMark({ team, className = '' }: { team: Pick<Team, 'icon' | 'emoji'>; className?: string }) {
  if (team.icon) return <img className={`team-mark ${className}`} src={iconSrc(team.icon)} alt="" draggable={false} />;
  return <span className={`team-mark team-mark-emoji ${className}`}>{team.emoji}</span>;
}
