import type { CSSProperties } from 'react';
import type { GameEvent } from '../game/types';

/**
 * A living backdrop behind an event, one per kind of event so no two events
 * look the same. The intro (stage "intro") gets:
 *   horse  – a trotting track streaming past under a dusk sky, dust in the air
 *   six    – a huge clock face with a sweeping hand and pulsing rings
 *   emoji  – film strips rolling top and bottom, emojis drifting up
 *   mafia  – rain, drifting smoke and a searchlight sweeping the night
 *   wheel  – spinning rays of colour with blinking bulbs and confetti
 *   deal   – kroner raining down over a golden casino shimmer
 *   custom – slow sparks rising
 * While the game itself is played (stage "play") three events get a richer,
 * themed scene behind the game board:
 *   horse  – a floodlit racecourse at dusk: cheering crowd, camera flashes,
 *            bunting, rails and turf streaming past
 *   six    – a neon countdown tunnel: scrolling perspective grids, a radar
 *            sweep, pulsing rings and rising embers
 *   emoji  – a cinema: velvet curtains, a chasing marquee, sweeping
 *            spotlights, a projector cone and drifting bokeh
 * Everything is CSS animation on a handful of elements; the particles get
 * deterministic positions so the picture is stable between renders.
 */
export function LiveBackdrop({ kind, stage = 'intro' }: { kind: GameEvent['kind']; stage?: 'intro' | 'play' }) {
  const play = stage === 'play';
  return (
    <div className={`live live-${kind} ${play ? `live-play live-play-${kind}` : ''}`} aria-hidden="true">
      {play ? playParts(kind) : parts(kind)}
      <div className="live-vignette" />
    </div>
  );
}

/** True for the events that have a dedicated backdrop behind the game itself. */
export function hasPlayBackdrop(kind: GameEvent['kind']): boolean {
  return kind === 'horse' || kind === 'six' || kind === 'emoji';
}

/** Deterministic pseudo-random in [0, 1) from an index, so layouts are stable. */
function rnd(i: number, salt = 1): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function spread(n: number, cls: string, style: (i: number) => CSSProperties, text?: (i: number) => string) {
  return Array.from({ length: n }, (_, i) => (
    <span key={i} className={cls} style={style(i)}>
      {text ? text(i) : null}
    </span>
  ));
}

const EMOJIS = ['🎬', '🍿', '🎥', '⭐', '🎞️', '🦁', '👑', '🚢', '🧊', '🕷️', '🐠', '🍫'];
const MONEY = ['💵', '💰', '🪙', '💸'];

function parts(kind: GameEvent['kind']) {
  switch (kind) {
    case 'horse':
      return (
        <>
          <div className="live-sky" />
          <div className="live-track" />
          <div className="live-rail" />
          {spread(18, 'live-dust', (i) => ({
            left: `${rnd(i) * 100}%`,
            top: `${55 + rnd(i, 2) * 40}%`,
            animationDelay: `${-rnd(i, 3) * 6}s`,
            animationDuration: `${4 + rnd(i, 4) * 4}s`,
            width: `${2 + rnd(i, 5) * 4}px`,
            height: `${2 + rnd(i, 5) * 4}px`,
          }))}
          {spread(4, 'live-runner', (i) => ({ top: `${58 + i * 9}%`, animationDelay: `${-i * 2.7}s`, animationDuration: `${9 + i * 1.3}s`, fontSize: `${2.2 + i * 0.3}rem` }), () => '🐎')}
        </>
      );
    case 'six':
      return (
        <>
          <div className="live-clock">
            <div className="live-clock-face" />
            <div className="live-clock-hand" />
            <div className="live-clock-minute" />
          </div>
          {spread(4, 'live-ring', (i) => ({ animationDelay: `${i * 1.5}s` }))}
          {spread(12, 'live-tick', (i) => ({ transform: `rotate(${i * 30}deg)` }))}
        </>
      );
    case 'emoji':
      return (
        <>
          <div className="live-strip live-strip-top" />
          <div className="live-strip live-strip-bottom" />
          {spread(14, 'live-float', (i) => ({
            left: `${rnd(i) * 96}%`,
            animationDelay: `${-rnd(i, 2) * 14}s`,
            animationDuration: `${12 + rnd(i, 3) * 10}s`,
            fontSize: `${1.6 + rnd(i, 4) * 2.4}rem`,
          }), (i) => EMOJIS[i % EMOJIS.length])}
        </>
      );
    case 'mafia':
      return (
        <>
          <div className="live-night" />
          <div className="live-beam" />
          <div className="live-beam live-beam-2" />
          {spread(5, 'live-smoke', (i) => ({
            left: `${rnd(i) * 90}%`,
            bottom: `${-10 + rnd(i, 2) * 30}%`,
            animationDelay: `${-rnd(i, 3) * 20}s`,
            animationDuration: `${18 + rnd(i, 4) * 10}s`,
            width: `${280 + rnd(i, 5) * 300}px`,
            height: `${280 + rnd(i, 5) * 300}px`,
          }))}
          <div className="live-rain" />
          <div className="live-rain live-rain-2" />
        </>
      );
    case 'wheel':
      return (
        <>
          <div className="live-rays" />
          <div className="live-rays live-rays-2" />
          {spread(24, 'live-bulb', (i) => ({
            left: `${50 + 46 * Math.cos((i / 24) * Math.PI * 2)}%`,
            top: `${50 + 46 * Math.sin((i / 24) * Math.PI * 2)}%`,
            animationDelay: `${(i % 3) * 0.33}s`,
          }))}
          {spread(22, 'live-confetti', (i) => ({
            left: `${rnd(i) * 100}%`,
            animationDelay: `${-rnd(i, 2) * 9}s`,
            animationDuration: `${7 + rnd(i, 3) * 6}s`,
            background: ['#ff4d6d', '#ffc53d', '#4da3ff', '#3ddc84', '#c77dff'][i % 5],
            width: `${8 + rnd(i, 4) * 8}px`,
            height: `${12 + rnd(i, 5) * 10}px`,
          }))}
        </>
      );
    case 'deal':
      return (
        <>
          <div className="live-casino" />
          <div className="live-shimmer" />
          {spread(3, 'live-spot', (i) => ({ left: `${20 + i * 30}%`, animationDelay: `${i * 1.1}s` }))}
          {spread(18, 'live-money', (i) => ({
            left: `${rnd(i) * 100}%`,
            animationDelay: `${-rnd(i, 2) * 10}s`,
            animationDuration: `${8 + rnd(i, 3) * 7}s`,
            fontSize: `${1.6 + rnd(i, 4) * 2}rem`,
            ['--sway' as string]: `${(rnd(i, 5) - 0.5) * 120}px`,
          }), (i) => MONEY[i % MONEY.length])}
        </>
      );
    default:
      return spread(14, 'live-spark', (i) => ({ left: `${rnd(i) * 100}%`, animationDelay: `${-rnd(i, 2) * 6}s`, animationDuration: `${5 + rnd(i, 3) * 4}s` }));
  }
}

const CINEMA = ['🍿', '🎬', '🎟️', '⭐', '🎥', '🥤'];
const CROWD = ['#ff4d6d', '#ffc53d', '#4da3ff', '#3ddc84', '#c77dff', '#ff8a3d', '#f4f6ff'];

function playParts(kind: GameEvent['kind']) {
  switch (kind) {
    case 'horse':
      return (
        <>
          <div className="live-arena-sky" />
          {spread(40, 'live-star', (i) => ({
            left: `${rnd(i) * 100}%`,
            top: `${rnd(i, 2) * 30}%`,
            animationDelay: `${-rnd(i, 3) * 4}s`,
            animationDuration: `${2 + rnd(i, 4) * 3}s`,
            width: `${1 + rnd(i, 5) * 2}px`,
            height: `${1 + rnd(i, 5) * 2}px`,
          }))}
          <div className="live-sun" />
          <div className="live-mast live-mast-left">
            <div className="live-mast-lamp" />
            <div className="live-mast-beam" />
          </div>
          <div className="live-mast live-mast-right">
            <div className="live-mast-lamp" />
            <div className="live-mast-beam" />
          </div>
          <div className="live-stand-roof" />
          <div className="live-crowd">
            {spread(90, 'live-fan', (i) => ({
              left: `${(i % 30) * 3.4 + rnd(i, 7) * 1.4}%`,
              top: `${Math.floor(i / 30) * 32 + rnd(i, 8) * 10}%`,
              background: CROWD[i % CROWD.length],
              animationDelay: `${-rnd(i, 9) * 1.6}s`,
              animationDuration: `${0.5 + rnd(i, 10) * 0.5}s`,
            }))}
            {spread(22, 'live-flash', (i) => ({
              left: `${rnd(i, 11) * 100}%`,
              top: `${rnd(i, 12) * 90}%`,
              animationDelay: `${rnd(i, 13) * 7}s`,
              animationDuration: `${3 + rnd(i, 14) * 6}s`,
            }))}
          </div>
          <div className="live-bunting" />
          <div className="live-rail live-rail-play" />
          <div className="live-turf" />
          <div className="live-dirt" />
          <div className="live-hedge" />
          {spread(16, 'live-dust', (i) => ({
            left: `${rnd(i) * 100}%`,
            top: `${62 + rnd(i, 2) * 34}%`,
            animationDelay: `${-rnd(i, 3) * 6}s`,
            animationDuration: `${3 + rnd(i, 4) * 4}s`,
            width: `${2 + rnd(i, 5) * 4}px`,
            height: `${2 + rnd(i, 5) * 4}px`,
          }))}
        </>
      );
    case 'six':
      return (
        <>
          <div className="live-tunnel" />
          <div className="live-grid live-grid-floor" />
          <div className="live-grid live-grid-ceiling" />
          <div className="live-horizon" />
          <div className="live-radar" />
          {spread(4, 'live-ring live-ring-play', (i) => ({ animationDelay: `${i * 1.5}s` }))}
          {spread(26, 'live-ember', (i) => ({
            left: `${rnd(i) * 100}%`,
            animationDelay: `${-rnd(i, 2) * 9}s`,
            animationDuration: `${6 + rnd(i, 3) * 6}s`,
            width: `${2 + rnd(i, 4) * 4}px`,
            height: `${2 + rnd(i, 4) * 4}px`,
            ['--sway' as string]: `${(rnd(i, 5) - 0.5) * 160}px`,
          }))}
          <div className="live-heartbeat" />
        </>
      );
    case 'emoji':
      return (
        <>
          <div className="live-theater" />
          <div className="live-projector" />
          <div className="live-spot-beam live-spot-beam-left" />
          <div className="live-spot-beam live-spot-beam-right" />
          {spread(14, 'live-bokeh', (i) => ({
            left: `${rnd(i) * 100}%`,
            top: `${rnd(i, 2) * 100}%`,
            width: `${60 + rnd(i, 3) * 140}px`,
            height: `${60 + rnd(i, 3) * 140}px`,
            animationDelay: `${-rnd(i, 4) * 20}s`,
            animationDuration: `${14 + rnd(i, 5) * 12}s`,
            background: `radial-gradient(circle, ${['rgba(255,197,61,0.22)', 'rgba(255,77,109,0.2)', 'rgba(77,163,255,0.2)', 'rgba(199,125,255,0.2)'][i % 4]} 0%, transparent 70%)`,
          }))}
          {spread(10, 'live-float live-float-dim', (i) => ({
            left: `${8 + rnd(i, 6) * 84}%`,
            animationDelay: `${-rnd(i, 7) * 16}s`,
            animationDuration: `${16 + rnd(i, 8) * 10}s`,
            fontSize: `${1.4 + rnd(i, 9) * 1.6}rem`,
          }), (i) => CINEMA[i % CINEMA.length])}
          <div className="live-marquee" />
          <div className="live-curtain live-curtain-left" />
          <div className="live-curtain live-curtain-right" />
          <div className="live-seats" />
        </>
      );
    default:
      return null;
  }
}
