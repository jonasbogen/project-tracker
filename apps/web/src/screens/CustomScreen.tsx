import { useEffect, useState } from 'react';
import { audio } from '../audio/engine';
import { formatClock, type ScreenProps } from './common';

export function CustomScreen({ state, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    audio.playMusic('arena');
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div className="screen custom-play">
      <h1 className="play-title">🎯 {event.title}</h1>
      <p className="play-sub">Øvelsen pågår. Registrer rekkefølgen når dere er ferdige.</p>

      <div className="stopwatch">
        <div className="stopwatch-time">{startedAt ? formatClock((now - startedAt) / 1000) : '0:00'}</div>
        {startedAt ? (
          <button className="btn btn-ghost" onClick={() => setStartedAt(null)}>
            Nullstill stoppeklokke
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={() => {
              audio.sfx('click');
              setStartedAt(Date.now());
            }}
          >
            Start stoppeklokke
          </button>
        )}
      </div>

      <button
        className="btn btn-primary btn-xl"
        data-primary
        onClick={() => {
          audio.sfx('click');
          go({ name: 'event-rank', index });
        }}
      >
        Registrer resultat →
      </button>
    </div>
  );
}
