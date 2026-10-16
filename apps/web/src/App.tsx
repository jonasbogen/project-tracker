import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { TeamMark } from './components/TeamMark';
import { audio } from './audio/engine';
import { FitScreen } from './components/FitScreen';
import { LiveBackdrop, hasPlayBackdrop } from './components/LiveBackdrop';
import { buildResult, totals } from './game/scoring';
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
import { StartVideoScreen } from './screens/StartVideoScreen';
import { FinaleScreen } from './screens/FinaleScreen';
import { PasswordGate } from './screens/PasswordGate';

const FILM_SEEN_KEY = 'spillkveld-film-seen';
const UNLOCKED_KEY = 'spillkveld-unlocked';
/** Intility photos behind the results after each event, one per event in turn. */
const RESULT_PHOTOS = ['/resultat-1.jpg', '/resultat-2.jpg', '/resultat-3.jpg', '/resultat-4.jpg'].map((src) => ({ src, soft: false }));
/**
 * Photos behind the "who came 1st–4th / who lost" page, one per event in turn.
 * The last two uploads are small, so they get a soft blur instead of showing pixels.
 */
const RANK_PHOTOS = [
  { src: '/rangering-1.jpg', soft: false },
  { src: '/rangering-3.jpg', soft: false },
  { src: '/rangering-2.jpg', soft: false },
  { src: '/rangering-4.jpg', soft: true },
  { src: '/rangering-5.jpg', soft: true },
];

/** The Intility photo behind a results-style page, or undefined on other pages. */
function resultsPhotoFor(phaseName: string, eventIndex: number): { src: string; soft: boolean } | undefined {
  const i = Math.max(0, eventIndex);
  if (phaseName === 'event-points') return RESULT_PHOTOS[i % RESULT_PHOTOS.length];
  if (phaseName === 'event-rank') return RANK_PHOTOS[i % RANK_PHOTOS.length];
  return undefined;
}

export default function App() {
  const { state, update, reset, ready } = useGameStore();
  const [fullscreen, setFullscreen] = useState(false);
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem(UNLOCKED_KEY));
  const [showFilm, setShowFilm] = useState(() => !sessionStorage.getItem(FILM_SEEN_KEY));

  const go = useCallback((phase: Phase) => update((s) => ({ ...s, phase })), [update]);

  useEffect(() => {
    audio.setMuted(state.settings.muted);
    audio.setVolume(state.settings.volume);
  }, [state.settings.muted, state.settings.volume]);

  useEffect(() => {
    // Nothing is audible behind the password gate; the first click after it
    // unlocks the audio (and starts the backing track).
    if (!unlocked) return;
    const unlock = (): void => {
      audio.ensure();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [unlocked]);

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
  const resultsPhoto = resultsPhotoFor(phase.name, eventIndex);

  // Horse race, Emoji Movie, Mafia and Deal or Drink work out the order
  // themselves, and 6 minutter knows who had the turn when the alarm went,
  // so their ranking page is skipped: what they hand over is committed
  // straight away and the results page opens. Only custom events (and an
  // old 6 minutter save without a loser) still ask the host.
  const autoRanked =
    phase.name === 'event-rank' &&
    !!event &&
    event.kind !== 'custom' &&
    (event.kind === 'six' ? !!state.pending?.loser : !!state.pending?.placements);
  useEffect(() => {
    if (!autoRanked || !event || phase.name !== 'event-rank') return;
    const index = phase.index;
    update((s) => {
      const placements = s.pending?.placements;
      const loser = s.pending?.loser;
      if (event.kind === 'six' ? !loser : !placements) return s;
      const result = buildResult(event, s.teams, { placements, loser, bonus: s.pending?.bonus, note: s.pending?.note });
      return {
        ...s,
        results: [...s.results.filter((r) => r.eventId !== event.id), result],
        pending: undefined,
        phase: { name: 'event-points', index },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRanked, event?.id]);

  if (phase.name !== 'setup' && eventIndex >= 0 && !event) {
    go({ name: 'setup' });
    return null;
  }

  if (!unlocked) {
    return (
      <PasswordGate
        onUnlock={() => {
          sessionStorage.setItem(UNLOCKED_KEY, '1');
          setUnlocked(true);
        }}
      />
    );
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
      screen = <SetupScreen {...props} onReset={() => reset(false)} onResetKeepTeams={() => reset(true)} />;
      break;
    case 'finale':
      // Back on the main page, with the results and the photo cavalcade laid over it.
      screen = (
        <>
          <SetupScreen {...props} onReset={() => reset(false)} onResetKeepTeams={() => reset(true)} />
          <FinaleScreen {...props} onPlayAgain={() => reset(true)} />
        </>
      );
      break;
    case 'start-video':
      screen = <StartVideoScreen {...props} />;
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
      // Events that bring their own order skip the ranking page (see the effect above).
      screen = autoRanked ? <div className="screen" /> : <RankScreen key={event!.id} {...props} index={phase.index} />;
      break;
    case 'event-points':
      screen = <PointsScreen key={event!.id} {...props} index={phase.index} />;
      break;
    case 'podium':
      screen = <PodiumScreen {...props} />;
      break;
  }

  return (
    <div
      className={`app phase-${phase.name} ${phase.name === 'finale' ? 'phase-setup' : ''} ${resultsPhoto ? 'phase-results' : ''} ${resultsPhoto?.soft ? 'phase-results-soft' : ''} kind-${event?.kind ?? 'none'} ${!ready ? 'app-loading' : ''}`}
      style={resultsPhoto ? ({ '--results-img': `url(${resultsPhoto.src})` } as CSSProperties) : undefined}
    >
      {phase.name === 'event-intro' && event && <LiveBackdrop key={event.kind} kind={event.kind} />}
      {phase.name === 'event-play' && event && hasPlayBackdrop(event.kind) && <LiveBackdrop key={`play-${event.kind}`} kind={event.kind} stage="play" />}
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-brand">Sosial Grunnmur</span>
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
        {phase.name === 'setup' || phase.name === 'finale' ? screen : <FitScreen fitKey={`${phase.name}-${eventIndex}-${event?.kind ?? ''}`}>{screen}</FitScreen>}
      </main>
    </div>
  );
}
