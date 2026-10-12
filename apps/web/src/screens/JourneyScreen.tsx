import { useEffect, useState } from 'react';
import { audio, type MusicName, type SfxName } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import type { ScreenProps } from './common';

interface Scene {
  id: string;
  duration: number;
  music?: MusicName;
  sfx: [SfxName, number][];
  caption: string;
}

const SCENES: Scene[] = [
  {
    id: 'wake',
    duration: 8000,
    sfx: [['snore', 200], ['snore', 1600], ['engine', 3200]],
    caption: 'Lørdag morgen. Du våkner i en lastebil hos NG Nordic i Riihimäki…',
  },
  {
    id: 'esko',
    duration: 7000,
    sfx: [['ding', 600]],
    caption: 'Der står Esko. Han takker for en fin helg og ønsker deg god tur hjem.',
  },
  {
    id: 'bike',
    duration: 8000,
    music: 'gallop',
    sfx: [['bell', 500], ['bell', 4000]],
    caption: 'Du sykler til flyplassen…',
  },
  {
    id: 'plane',
    duration: 8000,
    music: 'gallop',
    sfx: [['rocket', 800], ['whoosh', 3500]],
    caption: '…og finner et fly som går til Oslo.',
  },
  {
    id: 'train',
    duration: 11000,
    music: 'daylight',
    sfx: [['train', 300], ['buzz', 4500], ['fail', 6500]],
    caption: 'På Flytoget ser du at de er Intility-kunde. Plutselig: ingen dekning på telefonen. «Forbanna Edvard…» tenker du.',
  },
  {
    id: 'party',
    duration: 0,
    music: 'victory',
    sfx: [['cheer', 300], ['fanfare', 1500]],
    caption: 'Du kommer frem til vors – klar for festiviteter med Management Gradsa!',
  },
];

export function JourneyScreen({ go }: ScreenProps) {
  const [index, setIndex] = useState(0);
  const scene = SCENES[index];
  const last = index === SCENES.length - 1;

  useEffect(() => {
    if (scene.music) audio.playMusic(scene.music);
    else audio.stopMusic(0.8);
    const timers = scene.sfx.map(([name, delay]) => window.setTimeout(() => audio.sfx(name), delay));
    if (scene.duration > 0) timers.push(window.setTimeout(() => setIndex((i) => Math.min(i + 1, SCENES.length - 1)), scene.duration));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [scene]);

  const next = (): void => {
    if (last) {
      audio.sfx('whoosh');
      go({ name: 'event-intro', index: 0 });
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div className={`screen journey journey-${scene.id}`} key={scene.id}>
      <Confetti active={last} />

      {scene.id === 'wake' && (
        <div className="jscene">
          <div className="eyelid eyelid-top" />
          <div className="eyelid eyelid-bottom" />
          <div className="sun-rise" />
          <div className="ground" />
          <div className="truck">
            <span className="truck-emoji">🚛</span>
            <span className="truck-sign">NG Nordic</span>
          </div>
          <div className="place-sign">📍 Riihimäki, Finland</div>
          <div className="zzz">
            <span>z</span>
            <span>z</span>
            <span>Z</span>
          </div>
        </div>
      )}

      {scene.id === 'esko' && (
        <div className="jscene">
          <div className="ground" />
          <div className="esko">
            <div className="speech">Kiitos for en fin helg! God tur hjem 👋</div>
            <span className="esko-emoji">👷</span>
            <span className="esko-name">Esko</span>
          </div>
          <div className="you">
            <span className="you-emoji">🧍</span>
            <span className="esko-name">Deg</span>
          </div>
        </div>
      )}

      {scene.id === 'bike' && (
        <div className="jscene">
          <div className="sky-day" />
          <div className="trees">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ ['--i' as string]: i }}>
                {i % 3 === 0 ? '🌲' : '🌳'}
              </span>
            ))}
          </div>
          <div className="road" />
          <div className="cyclist">🚴</div>
          <div className="airport-sign">✈ Helsinki-Vantaa</div>
        </div>
      )}

      {scene.id === 'plane' && (
        <div className="jscene">
          <div className="sky-day sky-high" />
          <div className="clouds">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} style={{ ['--i' as string]: i }}>
                ☁️
              </span>
            ))}
          </div>
          <div className="board">
            <div className="board-row">
              <span>HEL → OSL</span>
              <span>Gate 12</span>
              <span className="board-status">Boarding</span>
            </div>
          </div>
          <div className="plane">✈️</div>
        </div>
      )}

      {scene.id === 'train' && (
        <div className="jscene">
          <div className="sky-day sky-evening" />
          <div className="rails" />
          <div className="train">
            <div className="train-banner">Flytoget · stolt Intility-kunde</div>
            <span className="train-emoji">🚆</span>
          </div>
          <div className="phone">
            <div className="phone-screen">
              <div className="signal">
                <span className="bar b1" />
                <span className="bar b2" />
                <span className="bar b3" />
                <span className="bar b4" />
              </div>
              <div className="no-signal">Ingen dekning</div>
              <div className="phone-thought">Forbanna Edvard…</div>
            </div>
          </div>
        </div>
      )}

      {scene.id === 'party' && (
        <div className="jscene">
          <div className="disco" />
          <div className="party-icons">
            {['🎉', '🍻', '🪩', '🥳', '🎶', '🍾'].map((e, i) => (
              <span key={i} style={{ ['--i' as string]: i }}>
                {e}
              </span>
            ))}
          </div>
          <div className="party-title">VORS</div>
          <div className="party-sub">Management Gradsa</div>
        </div>
      )}

      <div className="journey-caption">{scene.caption}</div>

      <div className="journey-progress">
        {SCENES.map((s, i) => (
          <span key={s.id} className={i <= index ? 'on' : ''} />
        ))}
      </div>

      {last ? (
        <button className="btn btn-primary btn-xl" data-primary onClick={next}>
          La spillene begynne →
        </button>
      ) : (
        <button className="btn btn-ghost journey-next" data-primary onClick={next}>
          Neste →
        </button>
      )}
    </div>
  );
}
