import { useCallback, useEffect, useState } from 'react';
import { TeamMark } from './components/TeamMark';
import { audio } from './audio/engine';
import { FitScreen } from './components/FitScreen';
import { totals } from './game/scoring';
import { useGameStore } from './game/store';
import type { Phase } from './game/types';
import { CustomScreen } from './screens/CustomScreen';
import { DealScreen } from './screens/DealScreen';
import { EmojiScreen } from './screens/EmojiScreen';
import { WheelScreen } from './screens/WheelScreen';
import { EventIntroScreen } from './screens/EventIntroScreen';
import { HorseScreen } from './screens/HorseScreen';
import { IntroScreen } from './screens/IntroScreen';
import { Cinematic } from './screens/Cinematic';
import { MafiaScreen } from './screens/MafiaScreen';
import { PodiumScreen } from './screens/PodiumScreen';
import { PointsScreen } from './screens/PointsScreen';
import { RankScreen } from './screens/RankScreen';
import { SetupScreen } from './screens/SetupScreen';
import { SixScreen } from './screens/SixScreen';

const FILM_SEEN_KEY = 'spillkveld-film-seen';

export default function App() {
  const { state, update, reset, ready } = useGameStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [showFilm, setShowFilm] = useState(() => !sessionStorage.getItem(FILM_SEEN_KEY));

  const go = useCallback((phase: Phase) => update((s) => ({ ...s, phase })), [update]);

  useEffect(() => {
    audio.setMuted(state.settings.muted);
    audio.setVolume(state.settings.volume);
  }, [state.settings.muted, state.settings.volume]);

  useEffect(() => {
    const unlock = (): void => {
      audio.ensure();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        const btn = document.querySelector<HTMLButtonElement>('button[data-primary]:not([disabled])');
        if (btn) {
          e.preventDefault();
          btn.click();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        update((s) => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } }));
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [update]);

  useEffect(() => {
    const onChange = (): void => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  const phase = state.phase;
  const eventIndex = 'index' in phase ? phase.index : -1;
  const event = eventIndex >= 0 ? state.events[eventIndex] : undefined;
  const sums = totals(state.teams, state.results);

  if (phase.name !== 'setup' && eventIndex >= 0 && !event) {
    go({ name: 'setup' });
    return null;
  }

  if (showFilm) {
    return (
      <Cinematic
        onDone={() => {
          // The opening film always lands on the setup page, whatever phase
          // was saved last time; "Fortsett spillet" picks the night up again.
          const firstOpen = !sessionStorage.getItem(FILM_SEEN_KEY);
          sessionStorage.setItem(FILM_SEEN_KEY, '1');
          setShowFilm(false);
          if (firstOpen) go({ name: 'setup' });
        }}
      />
    );
  }

  const props = { state, update, go };

  let screen: JSX.Element;
  switch (phase.name) {
    case 'setup':
      screen = <SetupScreen {...props} onReset={() => reset(false)} />;
      break;
    case 'intro':
      screen = <IntroScreen {...props} />;
      break;
    case 'event-intro':
      screen = <EventIntroScreen {...props} index={phase.index} />;
      break;
    case 'event-play':
      switch (event!.kind) {
        case 'six':
          screen = <SixScreen {...props} index={phase.index} />;
          break;
        case 'horse':
          screen = <HorseScreen key={event!.id} {...props} index={phase.index} />;
          break;
        case 'mafia':
          screen = <MafiaScreen {...props} index={phase.index} />;
          break;
        case 'emoji':
          screen = <EmojiScreen {...props} index={phase.index} />;
          break;
        case 'wheel':
          screen = <WheelScreen {...props} index={phase.index} />;
          break;
        case 'deal':
          screen = <DealScreen {...props} index={phase.index} />;
          break;
        default:
          screen = <CustomScreen {...props} index={phase.index} />;
      }
      break;
    case 'event-rank':
      screen = <RankScreen key={event!.id} {...props} index={phase.index} />;
      break;
    case 'event-points':
      screen = <PointsScreen key={event!.id} {...props} index={phase.index} />;
      break;
    case 'podium':
      screen = (
        <PodiumScreen
          {...props}
          onPlayAgain={() => {
            reset(true);
          }}
        />
      );
      break;
  }

  return (
    <div className={`app phase-${phase.name} kind-${event?.kind ?? 'none'} ${!ready ? 'app-loading' : ''}`}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-brand">🏆 Spillkveld</span>
          {event && (
            <span className="topbar-progress">
              Øvelse {eventIndex + 1}/{state.events.length} · {event.title}
            </span>
          )}
        </div>
        <div className="topbar-scores">
          {state.teams.map((t) => (
            <span key={t.id} className="topbar-chip" style={{ ['--team' as string]: t.color }}>
              <TeamMark team={t} /> {sums[t.id]}
            </span>
          ))}
        </div>
        <div className="topbar-right">
          <button
            className="btn btn-icon"
            title={state.settings.muted ? 'Skru på lyd (M)' : 'Demp (M)'}
            onClick={() => update((s) => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } }))}
          >
            {state.settings.muted ? '🔇' : '🔊'}
          </button>
          <input
            className="volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.settings.volume}
            title="Volum"
            onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, volume: Number(e.target.value) } }))}
          />
          <button className="btn btn-icon" title="Fullskjerm (F)" onClick={toggleFullscreen}>
            {fullscreen ? '🡼' : '⛶'}
          </button>
          {phase.name !== 'setup' && (
            <button className="btn btn-ghost btn-sm" onClick={() => go({ name: 'setup' })}>
              Oppsett
            </button>
          )}
          <button className="btn btn-icon" title="Spill filmen igjen" onClick={() => setShowFilm(true)}>
            🎬
          </button>
        </div>
      </header>
      <main className="stage">
        {phase.name === 'setup' ? screen : <FitScreen fitKey={`${phase.name}-${eventIndex}-${event?.kind ?? ''}`}>{screen}</FitScreen>}
      </main>
    </div>
  );
}
