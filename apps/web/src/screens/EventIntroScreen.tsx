import { useEffect } from 'react';
import { audio, type MusicName } from '../audio/engine';
import { KIND_EMOJI, RULE_BULLETS, type ScreenProps } from './common';

const INTRO_MUSIC: Record<string, MusicName> = {
  six: 'arena',
  horse: 'gallop',
  mafia: 'noir',
  emoji: 'arena',
  custom: 'arena',
};

export function EventIntroScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];

  useEffect(() => {
    audio.playMusic(INTRO_MUSIC[event.kind]);
    audio.sfx('whoosh');
  }, [event.kind]);

  const start = (): void => {
    audio.sfx('click');
    update((s) => ({ ...s, pending: undefined, six: undefined, mafia: undefined, emoji: undefined }));
    go({ name: 'event-play', index });
  };

  return (
    <div className={`screen event-intro event-intro-${event.kind}`}>
      <div className="event-intro-kicker">
        Øvelse {index + 1} av {state.events.length}
      </div>
      <div className="event-intro-emoji">{KIND_EMOJI[event.kind]}</div>
      <h1 className="event-intro-title">{event.title}</h1>
      {RULE_BULLETS[event.kind] ? (
        <ul className="event-intro-bullets">
          {RULE_BULLETS[event.kind]!.map((line, i) => (
            <li key={i} style={{ ['--i' as string]: i }}>
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="event-intro-rules">{event.rules}</p>
      )}

      <div className="points-chips">
        {event.kind === 'six' ? (
          <span className="chip chip-neg">Taperen: −{Math.abs(event.penalty)} poeng</span>
        ) : (
          event.points.map((p, i) => (
            <span key={i} className={`chip chip-place-${i + 1}`}>
              {i + 1}. plass: {p} p
            </span>
          ))
        )}
      </div>

      <button className="btn btn-primary btn-xl" data-primary onClick={start}>
        Start øvelsen →
      </button>
    </div>
  );
}
