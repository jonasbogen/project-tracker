import { useEffect, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Scoreboard } from '../components/Scoreboard';
import { standings } from '../game/scoring';
import type { ScreenProps } from './common';

/** Lines of the "under the hood" sequence before the winners are shown. */
function hoodLines(events: number, teams: number): string[] {
  return [
    'Åpner panseret …',
    'Kobler til poengdatabasen … OK',
    `Henter resultater fra ${events} øvelser … OK`,
    `Kontrollerer ${teams} lag for juks … stort sett OK`,
    'Regner sammen totalstillingen … OK',
    'Sorterer lagene etter poeng … OK',
    'Finner vinneren …',
  ];
}

const LINE_MS = 620;

type Rows = ReturnType<typeof standings>;

/** The three podium stands with their teams; shared by the podium and the finale. */
export function PodiumRow({ rows }: { rows: Rows }) {
  const byRank = (rank: number) => rows.filter((r) => r.rank === rank);
  const block = (items: Rows, place: number) => (
    <div className={`podium-block podium-${place}`} key={place}>
      <div className="podium-teams">
        {items.map((r) => (
          <div key={r.team.id} className="podium-team" style={{ ['--team' as string]: r.team.color }}>
            <span className="podium-emoji">
              <TeamMark team={r.team} />
            </span>
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
    <div className="podium-row">
      {block(byRank(2), 2)}
      {block(byRank(1), 1)}
      {block(byRank(3), 3)}
    </div>
  );
}

export function PodiumScreen({ state, go, onPlayAgain }: ScreenProps & { onPlayAgain: () => void }) {
  const rows = standings(state.teams, state.results);
  const lines = hoodLines(state.events.length, state.teams.length);
  const [shown, setShown] = useState(0);
  const booting = shown <= lines.length;

  // The hood sequence: one line at a time, then the podium.
  useEffect(() => {
    audio.sfx('riser');
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setShown(step);
      if (step <= lines.length) audio.sfx(step === lines.length ? 'ding' : 'tick');
      if (step > lines.length) window.clearInterval(id);
    }, LINE_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (booting) return;
    audio.playMusic('victory');
    audio.sfx('cheer');
    const id = window.setTimeout(() => audio.sfx('fanfare'), 1200);
    return () => window.clearTimeout(id);
  }, [booting]);

  if (booting) {
    const progress = Math.min(100, Math.round((shown / lines.length) * 100));
    return (
      <div className="screen podium hood">
        <div className="hood-panel">
          <div className="hood-head">
            <span className="hood-dot" />
            <span className="hood-dot" />
            <span className="hood-dot" />
            <span className="hood-title">premieutdeling.exe — under panseret</span>
          </div>
          <pre className="hood-log">
            {lines.slice(0, shown).map((line, i) => (
              <span key={i} className="hood-line" style={{ ['--i' as string]: i }}>
                {'> '}
                {line}
                {'\n'}
              </span>
            ))}
            <span className="hood-cursor">█</span>
          </pre>
          <div className="hood-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const first = rows.filter((r) => r.rank === 1);
  const rest = rows.filter((r) => r.rank > 3);

  return (
    <div className="screen podium">
      <Confetti active colors={rows.map((r) => r.team.color)} />
      <h1 className="podium-title">🏆 Vinner: {first.map((r) => r.team.name).join(' og ')}</h1>
      <PodiumRow rows={rows} />
      {rest.length > 0 && <p className="podium-rest">{rest.map((r) => `${r.rank}. ${r.team.name} (${r.total} p)`).join(' · ')}</p>}
      <div className="podium-board">
        <Scoreboard teams={state.teams} results={state.results} compact />
      </div>
      <div className="rank-actions">
        <button className="btn btn-ghost" onClick={() => go({ name: 'setup' })}>
          Til oppsett
        </button>
        <button className="btn btn-ghost" onClick={onPlayAgain}>
          Spill igjen med samme lag
        </button>
        <button className="btn btn-primary" data-primary onClick={() => go({ name: 'finale' })}>
          Videre →
        </button>
      </div>
    </div>
  );
}
