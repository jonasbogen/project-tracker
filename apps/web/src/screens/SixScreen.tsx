import { useEffect, useState } from 'react';
import { audio } from '../audio/engine';
import type { ScreenProps } from './common';

export function SixScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const six = state.six ?? { finished: false };
  const [, setTick] = useState(0);

  // While the hidden clock runs the host plays their own music, so the app stays silent.
  useEffect(() => {
    if (six.finished) audio.playMusic('alarm');
    else if (six.startedAt) audio.stopMusic(0.3);
    else audio.playMusic('arena');
  }, [six.finished, six.startedAt]);

  useEffect(() => {
    if (!six.startedAt || six.finished) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const elapsed = (Date.now() - six.startedAt!) / 1000;
      if (elapsed >= event.durationSec) {
        update((s) => ({ ...s, six: { ...(s.six ?? { finished: false }), finished: true } }));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [six.startedAt, six.finished, event.durationSec, update]);

  const start = (): void => {
    update((s) => ({ ...s, six: { startedAt: Date.now(), finished: false } }));
  };

  const skipToAlarm = (): void => {
    update((s) => ({ ...s, six: { startedAt: s.six?.startedAt ?? Date.now(), finished: true } }));
  };

  const abort = (): void => {
    if (!window.confirm('Avbryte og starte på nytt?')) return;
    audio.sfx('back');
    update((s) => ({ ...s, six: undefined }));
  };

  if (six.finished) {
    return (
      <div className="screen six six-finished">
        <div className="six-alarm-text">TIDEN ER UTE!</div>
        <div className="six-alarm-sub">{Math.round(event.durationSec / 60)} minutter har gått</div>
        <button
          className="btn btn-primary btn-xl"
          data-primary
          onClick={() => {
            audio.stopMusic(0.2);
            audio.sfx('click');
            go({ name: 'event-rank', index });
          }}
        >
          Stopp alarmen – hvem tapte? →
        </button>
      </div>
    );
  }

  if (six.startedAt) {
    return (
      <div className="screen six six-running">
        <div className="six-orb-wrap">
          <div className="six-orb" />
          <div className="six-orb-ring" />
          <div className="six-orb-ring six-orb-ring-2" />
        </div>
        <div className="six-running-text">Klokken går…</div>
        <div className="six-running-sub">Ingen får se tiden. Alarmen går når det er slutt.</div>
        <div className="six-side-actions">
          <button className="btn btn-ghost" onClick={skipToAlarm}>
            Hopp til alarmen
          </button>
          <button className="btn btn-ghost six-abort" onClick={abort}>
            Avbryt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen six six-ready">
      <div className="six-big-emoji">⏱️</div>
      <h1 className="play-title">{event.title}</h1>
      <p className="play-sub">
        Når du trykker start, skjules klokken. Alarmen går etter {Math.round(event.durationSec / 60)} minutter.
      </p>
      <button className="btn btn-primary btn-xl btn-start" data-primary onClick={start}>
        START
      </button>
    </div>
  );
}
