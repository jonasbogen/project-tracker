import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { buildResult } from '../game/scoring';
import type { WheelState } from '../game/types';
import type { ScreenProps } from './common';

const SLOTS = 25;
const SLOT_DEG = 360 / SLOTS;
const SPIN_MS = 6500;
const R = 240;

function initWheel(): WheelState {
  return { picks: {}, rotation: 0, spinning: false };
}

function polar(angleDeg: number, r: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function sectorPath(i: number, r: number): string {
  const a0 = i * SLOT_DEG;
  const a1 = a0 + SLOT_DEG;
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

const SECTOR_COLORS = ['#b8102f', '#1a1a22', '#e0a62b', '#1a1a22'];

export function WheelScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const teams = state.teams;
  const event = state.events[index];
  const w = state.wheel;
  const [now, setNow] = useState(Date.now());
  const tickTimer = useRef<number | null>(null);

  const setW = (fn: (w: WheelState) => WheelState): void => update((s) => ({ ...s, wheel: s.wheel ? fn(s.wheel) : s.wheel }));

  useEffect(() => {
    audio.playMusic('arena');
    if (!w) update((s) => ({ ...s, wheel: initWheel() }));
  }, [w, update]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 150);
    return () => window.clearInterval(id);
  }, []);

  const spinDone = !!w?.spunAt && now - w.spunAt >= SPIN_MS;
  const landed = w?.result !== undefined && spinDone;

  // Decelerating ticks while the wheel turns.
  useEffect(() => {
    if (!w?.spinning || !w.spunAt) return;
    let cancelled = false;
    const start = w.spunAt;
    const schedule = (): void => {
      const elapsed = Date.now() - start;
      if (cancelled || elapsed >= SPIN_MS) return;
      const progress = elapsed / SPIN_MS;
      const delay = 40 + Math.pow(progress, 2.2) * 700;
      tickTimer.current = window.setTimeout(() => {
        audio.sfx('tick');
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (tickTimer.current) window.clearTimeout(tickTimer.current);
    };
  }, [w?.spinning, w?.spunAt]);

  const hitTeams = landed ? teams.filter((t) => w!.picks[t.id] === w!.result) : [];

  useEffect(() => {
    if (!landed) return;
    setW((st) => (st.spinning ? { ...st, spinning: false } : st));
    if (hitTeams.length) {
      audio.sfx('cheer');
      window.setTimeout(() => audio.sfx('fanfare'), 400);
    } else {
      audio.sfx('boo');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  if (!w) return null;

  const pickingTeam = teams.find((t) => !w.picks[t.id]);
  const allPicked = !pickingTeam;
  const ownerOfSlot = (n: number) => teams.find((t) => w.picks[t.id] === n);

  const pick = (n: number): void => {
    if (w.spunAt) return;
    const owner = ownerOfSlot(n);
    if (owner) {
      audio.sfx('back');
      setW((st) => {
        const picks = { ...st.picks };
        delete picks[owner.id];
        return { ...st, picks };
      });
      return;
    }
    if (!pickingTeam) return;
    audio.sfx('click');
    setW((st) => ({ ...st, picks: { ...st.picks, [pickingTeam.id]: n } }));
  };

  const spin = (): void => {
    audio.sfx('rocket');
    const result = 1 + Math.floor(Math.random() * SLOTS);
    const center = (result - 1) * SLOT_DEG + SLOT_DEG / 2;
    const jitter = (Math.random() - 0.5) * SLOT_DEG * 0.6;
    const target = (360 - center + jitter + 360) % 360;
    setW((st) => {
      const current = ((st.rotation % 360) + 360) % 360;
      const delta = (target - current + 360) % 360;
      return { ...st, result, spinning: true, spunAt: Date.now(), rotation: st.rotation + 360 * 6 + delta };
    });
  };

  const finish = (): void => {
    audio.sfx('whoosh');
    const result = buildResult(event, teams, {
      hits: hitTeams.map((t) => t.id),
      note: hitTeams.length ? `Hjulet stoppet på ${w.result}.` : `Hjulet stoppet på ${w.result} – ingen traff.`,
    });
    update((s) => ({ ...s, results: [...s.results.filter((r) => r.eventId !== event.id), result], pending: undefined }));
    go({ name: 'event-points', index });
  };

  const winnerColors = hitTeams.length ? [hitTeams[0].color, '#fff', '#ffc53d'] : undefined;

  return (
    <div className="screen wheel">
      <Confetti active={landed && hitTeams.length > 0} burst colors={winnerColors} />
      <div className="wheel-layout">
        <div className="wheel-side">
          <h1 className="play-title">🎡 Wheel of Fortune</h1>
          {!w.spunAt && pickingTeam && (
            <p className="play-sub big">
              <span className="team-badge" style={{ ['--team' as string]: pickingTeam.color }}>
                {pickingTeam.emoji} {pickingTeam.name}
              </span>{' '}
              velger felt
            </p>
          )}
          {!w.spunAt && allPicked && <p className="play-sub">Alle har valgt. Trykk på et felt for å angre, eller snurr hjulet.</p>}
          {w.spunAt && !landed && <p className="play-sub big">Hjulet snurrer …</p>}
          {landed && (
            <div className="wheel-result">
              <div className="wheel-result-num">{w.result}</div>
              {hitTeams.length ? (
                hitTeams.map((t) => (
                  <div key={t.id} className="wheel-result-hit" style={{ ['--team' as string]: t.color }}>
                    {t.emoji} {t.name} traff! +{event.points[0]} poeng
                  </div>
                ))
              ) : (
                <div className="wheel-result-miss">Ingen traff. Hjulet er nådeløst.</div>
              )}
            </div>
          )}
          <div className="wheel-picks">
            {teams.map((t) => (
              <div key={t.id} className={`wheel-pick-row ${landed && w.picks[t.id] === w.result ? 'wheel-pick-hit' : ''}`} style={{ ['--team' as string]: t.color }}>
                <span>
                  {t.emoji} {t.name}
                </span>
                <strong>{w.picks[t.id] ?? '–'}</strong>
              </div>
            ))}
          </div>
          {allPicked && !w.spunAt && (
            <button className="btn btn-primary btn-xl btn-start" data-primary onClick={spin}>
              SNURR HJULET!
            </button>
          )}
          {landed && (
            <button className="btn btn-primary btn-xl" data-primary onClick={finish}>
              Til resultat →
            </button>
          )}
        </div>

        <div className="wheel-stage">
          <div className="wheel-pointer" />
          <svg
            className={`wheel-svg ${w.spinning ? 'wheel-spinning' : ''}`}
            viewBox={`${-R - 20} ${-R - 20} ${2 * R + 40} ${2 * R + 40}`}
            style={{ transform: `rotate(${w.rotation}deg)`, transition: w.spunAt ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.75, 0.08, 1)` : 'none' }}
          >
            <circle r={R + 14} fill="#2a1a08" stroke="#e0a62b" strokeWidth={6} />
            {Array.from({ length: SLOTS }).map((_, i) => {
              const n = i + 1;
              const owner = ownerOfSlot(n);
              const [tx, ty] = polar(i * SLOT_DEG + SLOT_DEG / 2, R * 0.8);
              const isHit = landed && w.result === n;
              return (
                <g key={n} className={`wheel-slot ${owner ? 'wheel-slot-taken' : ''} ${isHit ? 'wheel-slot-hit' : ''}`} onClick={() => pick(n)}>
                  <path d={sectorPath(i, R)} fill={owner ? owner.color : SECTOR_COLORS[i % SECTOR_COLORS.length]} stroke="#f6d77a" strokeWidth={1.5} />
                  <text
                    x={tx}
                    y={ty}
                    fill={owner ? '#111' : '#fff'}
                    fontSize={owner ? 22 : 20}
                    fontWeight={900}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${i * SLOT_DEG + SLOT_DEG / 2} ${tx} ${ty})`}
                  >
                    {owner ? `${owner.emoji}${n}` : n}
                  </text>
                </g>
              );
            })}
            {Array.from({ length: SLOTS }).map((_, i) => {
              const [px, py] = polar(i * SLOT_DEG, R + 7);
              return <circle key={i} cx={px} cy={py} r={4} fill="#fff3c4" />;
            })}
            <circle r={34} fill="#e0a62b" stroke="#fff3c4" strokeWidth={4} />
            <circle r={12} fill="#2a1a08" />
          </svg>
        </div>
      </div>
    </div>
  );
}
