import type { Team } from '../game/types';
import { TeamMark } from './TeamMark';

export function TeamBadge({ team, size = 'md', points }: { team: Team; size?: 'sm' | 'md' | 'lg'; points?: number }) {
  return (
    <span className={`team-badge team-badge-${size}`} style={{ ['--team' as string]: team.color }}>
      <span className="team-badge-emoji"><TeamMark team={team} /></span>
      <span className="team-badge-name">{team.name}</span>
      {points !== undefined && <span className="team-badge-points">{points}</span>}
    </span>
  );
}
