import { useEffect } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Scoreboard } from '../components/Scoreboard';
import { standings } from '../game/scoring';
import type { ScreenProps } from './common';

export function PodiumScreen({ state, go, onPlayAgain }: ScreenProps & { onPlayAgain: () => void }) {
  const rows = standings(state.teams, state.results);

  useEffect(() => {
    audio.playMusic('victory');
    audio.sfx('cheer');
    const id = window.setTimeout(() => audio.sfx('fanfare'), 1200);
    return () => window.clearTimeout(id);
  }, []);

  const byRank = (rank: number) => rows.filter((r) => r.rank === rank);
  const first = byRank(1);
  const second = byRank(2);
  const third = byRank(3);
  const rest = rows.filter((r) => r.rank > 3);

  const block = (items: typeof rows, place: number) => (
    <div className={`podium-block podium-${place}`} key={place}>
      <div className="podium-teams">
        {items.map((r) => (
          <div key={r.team.id} className="podium-team" style={{ ['--team' as string]: r.team.color }}>
            <span className="podium-emoji"><TeamMark team={r.team} /></span>
            <span className="podium-name">{r.team.name}</span>
            <span className="podium-points">{r.total} p</span>
          </div>
        ))}
      </div>
      <div className="podium-stand">
        <span>{place}</span>
      </div>
    </div>
  );

  return (
    <div className="screen podium">
      <Confetti active colors={rows.map((r) => r.team.color)} />
      <h1 className="podium-title">🏆 Vinner: {first.map((r) => r.team.name).join(' og ')}</h1>
      <div className="podium-row">
        {block(second, 2)}
        {block(first, 1)}
        {block(third, 3)}
      </div>
      {rest.length > 0 && (
        <p className="podium-rest">
          {rest.map((r) => `${r.rank}. ${r.team.name} (${r.total} p)`).join(' · ')}
        </p>
      )}
      <div className="podium-board">
        <Scoreboard teams={state.teams} results={state.results} compact />
      </div>
      <div className="rank-actions">
        <button className="btn btn-ghost" onClick={() => go({ name: 'setup' })}>
          Til oppsett
        </button>
        <button className="btn btn-primary" onClick={onPlayAgain}>
          Spill igjen med samme lag
        </button>
      </div>
    </div>
  );
}
