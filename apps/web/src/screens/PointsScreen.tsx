import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Scoreboard } from '../components/Scoreboard';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { nextAfterPoints, type ScreenProps } from './common';

/** Seconds the finished results stay before the show moves on by itself. */
const AUTO_SECONDS = 5;

export function PointsScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const result = state.results.find((r) => r.eventId === event.id);
  const teams = state.teams;
  const [revealed, setRevealed] = useState(0);
  const advanced = useRef(false);
  const isSix = event.kind === 'six';
  const isWheel = event.kind === 'wheel';
  const hitTeams = isWheel ? teams.filter((t) => result?.hits?.includes(t.id)) : [];

  const order = isSix || isWheel
    ? []
    : [...teams].sort((a, b) => (result?.placements?.[b.id] ?? 9) - (result?.placements?.[a.id] ?? 9));
  const totalSteps = isSix || isWheel ? 1 : order.length;
  const done = revealed >= totalSteps;

  useEffect(() => {
    audio.playMusic('drumroll');
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setRevealed(step);
      if (isSix) {
        audio.sfx('fail');
      } else if (isWheel) {
        audio.sfx(hitTeams.length ? 'sting' : 'fail');
      } else if (step === totalSteps) {
        audio.sfx('sting');
      } else {
        audio.sfx('ding');
      }
      if (step >= totalSteps) {
        window.clearInterval(id);
        window.setTimeout(() => audio.playMusic(isSix ? 'arena' : 'victory'), 300);
      }
    }, isSix || isWheel ? 700 : 1100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSix, isWheel, totalSteps]);

  const previousResults = state.results.filter((r) => r.eventId !== event.id);
  const resultsForBoard = done && result ? [...previousResults, result] : previousResults;

  const loserTeam = isSix ? teams.find((t) => t.id === result?.loser) : undefined;

  // Once everything is revealed the show moves on by itself after a few
  // seconds; the button stays as a shortcut.
  const advance = (): void => {
    if (advanced.current) return;
    advanced.current = true;
    audio.sfx('whoosh');
    const next = nextAfterPoints(state, index);
    if (state.singleEvent) update((s) => ({ ...s, singleEvent: undefined }));
    go(next);
  };
  const left = useAutoAdvance(done, AUTO_SECONDS, advance);

  return (
    <div className="screen points">
      <Confetti active={done && !isSix && !(isWheel && hitTeams.length === 0)} burst />
      <div className="points-kicker">
        Sosial Grunnmur · Øvelse {index + 1} av {state.events.length}
      </div>
      <h1 className="play-title">{event.title} – resultat</h1>
      <p className="points-lead">
        {isSix
          ? 'Laget som brukte lengst tid får trekk. Resten går videre uten poeng.'
          : isWheel
            ? 'Lagene som traff feltet hjulet stoppet på, får poeng.'
            : 'Plasseringene avsløres én etter én, fra sist til først.'}
      </p>

      {isWheel ? (
        <div className="reveal-row">
          {revealed > 0 &&
            (hitTeams.length === 0 ? (
              <div className="six-loser-card wheel-miss">
                <span className="six-loser-emoji">🎡</span>
                <span className="six-loser-name">Ingen traff</span>
                <span className="muted">Hjulet stoppet på et tomt felt</span>
              </div>
            ) : (
              hitTeams.map((t) => (
                <div key={t.id} className="six-loser-card" style={{ ['--team' as string]: t.color }}>
                  <span className="six-loser-emoji"><TeamMark team={t} /></span>
                  <span className="six-loser-name">{t.name}</span>
                  <span className="reveal-points">+{result?.points[t.id] ?? 0}</span>
                </div>
              ))
            ))}
        </div>
      ) : isSix ? (
        <div className="six-loser">
          {revealed > 0 && loserTeam && (
            <div className="six-loser-card" style={{ ['--team' as string]: loserTeam.color }}>
              <span className="six-loser-emoji"><TeamMark team={loserTeam} /></span>
              <span className="six-loser-name">{loserTeam.name}</span>
              <span className="six-loser-points">−{Math.abs(event.penalty)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="reveal-row">
          {order.map((t, i) => {
            const shown = i < revealed;
            const place = result?.placements?.[t.id];
            return (
              <div
                key={t.id}
                className={`reveal-card ${shown ? 'reveal-card-shown' : ''} place-${place}`}
                style={{ ['--team' as string]: t.color }}
              >
                <span className="reveal-place">{shown ? `${place}.` : '?'}</span>
                <span className="reveal-emoji">{shown ? <TeamMark team={t} /> : '❔'}</span>
                <span className="reveal-name">{shown ? t.name : '…'}</span>
                <span className="reveal-points">{shown ? `+${result?.points[t.id] ?? 0}` : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className={`points-board ${done ? 'points-board-shown' : ''}`}>
        <h2>Sammenlagt</h2>
        <Scoreboard teams={teams} results={resultsForBoard} delta={done ? result?.points : undefined} />
      </div>

      <button className="btn btn-primary btn-xl" data-primary disabled={!done} onClick={advance}>
        {state.singleEvent ? 'Til oppsett →' : index + 1 < state.events.length ? 'Neste øvelse →' : 'Til premieutdeling →'}
        {left !== null && left > 0 && <span className="auto-count">{left}</span>}
      </button>
    </div>
  );
}
