import { useEffect, useState } from 'react';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Scoreboard } from '../components/Scoreboard';
import { nextAfterPoints, type ScreenProps } from './common';

export function PointsScreen({ state, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const result = state.results.find((r) => r.eventId === event.id);
  const teams = state.teams;
  const [revealed, setRevealed] = useState(0);
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

  return (
    <div className="screen points">
      <Confetti active={done && !isSix && !(isWheel && hitTeams.length === 0)} burst />
      <h1 className="play-title">{event.title} – resultat</h1>

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
                  <span className="six-loser-emoji">{t.emoji}</span>
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
              <span className="six-loser-emoji">{loserTeam.emoji}</span>
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
                <span className="reveal-emoji">{shown ? t.emoji : '❔'}</span>
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

      <button
        className="btn btn-primary btn-xl"
        data-primary
        disabled={!done}
        onClick={() => {
          audio.sfx('whoosh');
          go(nextAfterPoints(state, index));
        }}
      >
        {index + 1 < state.events.length ? 'Neste øvelse →' : 'Til premieutdeling →'}
      </button>
    </div>
  );
}
