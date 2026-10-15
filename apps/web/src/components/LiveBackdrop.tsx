import type { CSSProperties } from 'react';
import type { GameEvent } from '../game/types';

/**
 * A living backdrop behind the event intro, one per kind of event so no two
 * events look the same:
 *   horse  – a trotting track streaming past under a dusk sky, dust in the air
 *   six    – a huge clock face with a sweeping hand and pulsing rings
 *   emoji  – film strips rolling top and bottom, emojis drifting up
 *   mafia  – rain, drifting smoke and a searchlight sweeping the night
 *   wheel  – spinning rays of colour with blinking bulbs and confetti
 *   deal   – kroner raining down over a golden casino shimmer
 *   custom – slow sparks rising
 * Everything is CSS animation on a handful of elements; the particles get
 * deterministic positions so the picture is stable between renders.
 */
export function LiveBackdrop({ kind }: { kind: GameEvent['kind'] }) {
  return (
    <div className={`live live-${kind}`} aria-hidden="true">
      {parts(kind)}
      <div className="live-vignette" />
    </div>
  );
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
