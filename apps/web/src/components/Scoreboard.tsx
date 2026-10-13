import { standings } from '../game/scoring';
import { TeamMark } from './TeamMark';
import type { EventResult, Team, TeamId } from '../game/types';

export function Scoreboard({
  teams,
  results,
  delta,
  compact = false,
}: {
  teams: Team[];
  results: EventResult[];
  delta?: Record<TeamId, number>;
  compact?: boolean;
}) {
  const rows = standings(teams, results);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.total)));
  const min = Math.min(0, ...rows.map((r) => r.total));
  const span = Math.max(1, max - min);

  return (
    <div className={`scoreboard ${compact ? 'scoreboard-compact' : ''}`}>
      {rows.map((r) => {
        const d = delta?.[r.team.id];
        const width = ((r.total - min) / span) * 100;
        return (
          <div key={r.team.id} className="score-row" style={{ ['--team' as string]: r.team.color }}>
            <div className="score-rank">{r.rank}</div>
            <div className="score-team">
              <span className="score-emoji"><TeamMark team={r.team} /></span>
              <span className="score-name">{r.team.name}</span>
            </div>
            <div className="score-bar-wrap">
              <div className="score-bar" style={{ width: `${Math.max(2, width)}%` }} />
            </div>
            <div className="score-total">
              {r.total}
              {d !== undefined && d !== 0 && (
                <span className={`score-delta ${d > 0 ? 'pos' : 'neg'}`}>
                  {d > 0 ? '+' : ''}
                  {d}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
