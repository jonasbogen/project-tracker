import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { buildResult, pointsForPlacements } from '../game/scoring';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import type { Placements, TeamId } from '../game/types';
import type { ScreenProps } from './common';

const PLACE_LABEL = ['1.', '2.', '3.', '4.'];
/** Seconds a complete pick stays on screen before it confirms itself. */
const AUTO_SECONDS = 5;

export function RankScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const teams = state.teams;
  const isSix = event.kind === 'six';
  const confirmed = useRef(false);

  const [placements, setPlacements] = useState<Placements>(() => state.pending?.placements ?? {});
  const [loser, setLoser] = useState<TeamId | undefined>(() => state.pending?.loser);

  useEffect(() => {
    if (audio.currentMusic !== 'alarm') audio.playMusic('drumroll');
  }, []);

  const ranked = Object.keys(placements).length;
  const nextPlace = ranked + 1;
  const complete = isSix ? !!loser : ranked === teams.length;

  const pick = (id: TeamId): void => {
    audio.sfx('click');
    if (isSix) {
      setLoser(id);
      return;
    }
    if (placements[id]) {
      const copy = { ...placements };
      delete copy[id];
      setPlacements(copy);
      return;
    }
    setPlacements({ ...placements, [id]: nextPlace });
  };

  const confirm = (): void => {
    if (!complete || confirmed.current) return;
    confirmed.current = true;
    audio.sfx('ding');
    const result = buildResult(event, teams, { placements, loser, note: state.pending?.note });
    update((s) => ({
      ...s,
      results: [...s.results.filter((r) => r.eventId !== event.id), result],
      pending: undefined,
    }));
    go({ name: 'event-points', index });
  };

  // When every placement (or the loser) is picked, the page confirms itself
  // after a few seconds. Undoing a pick cancels the countdown.
  const left = useAutoAdvance(complete, AUTO_SECONDS, confirm);

  const preview = isSix ? null : pointsForPlacements(placements, event.points);

  return (
    <div className="screen rank">
      <h1 className="play-title">{isSix ? 'Hvem tapte?' : 'Hvem kom på 1., 2., 3. og 4.?'}</h1>
      <p className="play-sub">
        {isSix
          ? `Laget du velger får −${Math.abs(event.penalty)} poeng.`
          : state.pending?.note ?? `Trykk på lagene i rekkefølge. Neste: ${PLACE_LABEL[Math.min(ranked, 3)]} plass. Trykk igjen for å angre.`}
      </p>

      <div className="rank-grid">
        {teams.map((t) => {
          const place = placements[t.id];
          const selectedLoser = loser === t.id;
          return (
            <button
              key={t.id}
              className={`rank-card ${place || selectedLoser ? 'rank-card-picked' : ''} ${selectedLoser ? 'rank-card-loser' : ''}`}
              style={{ ['--team' as string]: t.color }}
              onClick={() => pick(t.id)}
            >
              <span className="rank-card-emoji"><TeamMark team={t} /></span>
              <span className="rank-card-name">{t.name}</span>
              {place && (
                <span className={`rank-card-place place-${place}`}>
                  {place}.
                  {preview && <small> {preview[t.id]} p</small>}
                </span>
              )}
              {selectedLoser && <span className="rank-card-place place-loser">−{Math.abs(event.penalty)}</span>}
            </button>
          );
        })}
      </div>

      <div className="rank-actions">
        {!isSix && ranked > 0 && (
          <button className="btn btn-ghost" onClick={() => setPlacements({})}>
            Nullstill
          </button>
        )}
        <button className="btn btn-primary btn-xl" data-primary disabled={!complete} onClick={confirm}>
          Bekreft og vis poeng →{left !== null && left > 0 && <span className="auto-count">{left}</span>}
        </button>
      </div>
    </div>
  );
}
