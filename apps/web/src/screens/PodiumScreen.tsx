import { useEffect, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
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

/**
 * The "under the hood" sequence after the last event. When the log has run
 * through, it goes straight on to the finale (the song, the photos and the
 * results); there is no results page with a button in between.
 */
export function PodiumScreen({ state, go }: ScreenProps) {
  const lines = hoodLines(state.events.length, state.teams.length);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    audio.sfx('riser');
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setShown(step);
      if (step <= lines.length) audio.sfx(step === lines.length ? 'ding' : 'tick');
      if (step > lines.length) {
        window.clearInterval(id);
        go({ name: 'finale' });
      }
    }, LINE_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min(100, Math.round((Math.min(shown, lines.length) / lines.length) * 100));
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
