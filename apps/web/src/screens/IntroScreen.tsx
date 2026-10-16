import { useEffect } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import type { ScreenProps } from './common';

/** The user's photo behind the intro: three colleagues in light-blue shirts. */
const INTRO_PHOTO = '/intro-bg.jpg';
const TITLE_WORDS = ['SOSIAL', 'GRUNNMUR'];

export function IntroScreen({ state, go }: ScreenProps) {
  useEffect(() => {
    audio.playMusic('arena');
  }, []);

  let letterIndex = 0;

  return (
    <div className="screen intro">
      <div className="intro-bg" aria-hidden="true">
        <img className="intro-photo" src={INTRO_PHOTO} alt="" />
        <div className="intro-shade" />
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="intro-spark" style={{ ['--i' as string]: i }} />
        ))}
      </div>
      {/* One word per group so the title can wrap between the words, never inside one. */}
      <h1 className="intro-title">
        {TITLE_WORDS.map((word) => (
          <span key={word} className="intro-word">
            {word.split('').map((ch) => {
              const i = letterIndex++;
              return (
                <span key={i} className="intro-letter" style={{ ['--i' as string]: i }}>
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
      </h1>
      <p className="intro-sub">
        {state.teams.length} lag · {state.events.length} øvelser · ett vinnerlag
      </p>

      <div className="intro-teams">
        {state.teams.map((t, i) => (
          <div key={t.id} className="intro-team" style={{ ['--team' as string]: t.color, ['--i' as string]: i }}>
            <span className="intro-team-emoji"><TeamMark team={t} /></span>
            <span className="intro-team-name">{t.name}</span>
            {t.players.length > 0 && <span className="intro-team-players">{t.players.join(' · ')}</span>}
          </div>
        ))}
      </div>

      <ol className="intro-timeline">
        {state.events.map((e, i) => (
          <li key={e.id} style={{ ['--i' as string]: i }}>
            <span className="timeline-emoji">❓</span>
            <span>Hemmelig øvelse {i + 1}</span>
          </li>
        ))}
      </ol>

      <button
        className="btn btn-primary btn-xl"
        data-primary
        onClick={() => {
          audio.sfx('fanfare');
          go({ name: 'event-intro', index: 0 });
        }}
      >
        Kjør i gang! →
      </button>
    </div>
  );
}
