import { useEffect, useRef, useState } from 'react';
import { iconSrc, TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Portal } from '../components/Portal';
import { buildResult } from '../game/scoring';
import type { WheelState } from '../game/types';
import type { ScreenProps } from './common';

const SLOTS = 12;
const SLOT_DEG = 360 / SLOTS;
const SPIN_MS = 6500;
const R = 240;
/** How far into the first spin the "network error" strikes. */
const PRANK_AT_MS = 2300;
/** How long the fake error page sits there before the fix link shows up. */
const PRANK_LINK_AFTER_MS = 4500;
const PRANK_VIDEO = '/teams-video.mp4';
/** The Smirnoff Ice video, back for the last Ice chance of the night. */
const ICE_VIDEO = '/ice-video.mp4';
/** Extra slots a team gets on the wheel for chugging an Ice. */
const ICE_EXTRA_SLOTS = 2;

/** Current visual rotation of an element mid-transition, in degrees 0..360. */
function currentAngle(el: Element | null): number | null {
  if (!el) return null;
  const t = getComputedStyle(el).transform;
  const m = /matrix\(([^)]+)\)/.exec(t);
  if (!m) return null;
  const [a, b] = m[1].split(',').map(Number);
  const deg = (Math.atan2(b, a) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [fixLink, setFixLink] = useState(false);
  const [reloading, setReloading] = useState(false);

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

  // The staged network error: a bit into the first spin the whole screen
  // "crashes". The wheel is frozen at its current angle under the overlay so
  // it can pick the spin up again afterwards.
  useEffect(() => {
    if (!w?.spinning || !w.spunAt || w.prank) return;
    const id = window.setTimeout(() => {
      const angle = currentAngle(svgRef.current);
      audio.pauseBackground();
      setFixLink(false);
      setReloading(false);
      setW((st) => ({ ...st, rotation: angle ?? st.rotation, spinning: false, spunAt: undefined, prank: 'error' }));
    }, PRANK_AT_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.spinning, w?.spunAt, w?.prank]);

  useEffect(() => {
    if (w?.prank !== 'error') return;
    const id = window.setTimeout(() => setFixLink(true), PRANK_LINK_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [w?.prank]);

  // Leaving the wheel mid-prank (host panel, reset) must not leave the music held.
  useEffect(() => () => audio.resumeBackground(), []);

  const slotsOf = (id: string): number[] => [w?.picks[id], ...(w?.extra?.[id] ?? [])].filter((n): n is number => n !== undefined);
  const hitTeams = landed ? teams.filter((t) => slotsOf(t.id).includes(w!.result!)) : [];

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

  // The Ice round: once every team has picked, the Ice song and video come
  // back and the last team without an Ice chance tonight may chug one for a
  // second slot. Runs once.
  const everyonePicked = !!w && teams.every((t) => !!w.picks[t.id]);
  useEffect(() => {
    if (!w || w.spunAt || w.iceDone || w.ice || !everyonePicked || teams.length === 0) return;
    const offered = new Set(state.iceOffered ?? []);
    const team = teams.find((t) => !offered.has(t.id));
    if (!team) {
      setW((st) => ({ ...st, iceDone: true }));
      return;
    }
    audio.pauseBackground();
    update((s) => ({
      ...s,
      iceOffered: [...(s.iceOffered ?? []), team.id],
      wheel: s.wheel ? { ...s.wheel, ice: { team: team.id, stage: 'video' } } : s.wheel,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyonePicked, w?.iceDone, !!w?.ice, w?.spunAt, teams.length]);

  if (!w) return null;

  const iceTeam = w.ice ? teams.find((t) => t.id === w.ice!.team) : undefined;
  const iceOpen = !!w.ice && !w.iceDone;
  /** The Ice team still has extra slots to place. */
  const extraPlaced = w.ice ? (w.extra?.[w.ice.team] ?? []).length : 0;
  const extraPending = !!w.iceDone && !!w.ice?.accepted && extraPlaced < ICE_EXTRA_SLOTS;
  const pickingTeam = teams.find((t) => !w.picks[t.id]) ?? (extraPending ? iceTeam : undefined);
  const allPicked = !pickingTeam && !iceOpen;
  const ownerOfSlot = (n: number) => teams.find((t) => slotsOf(t.id).includes(n));

  const pick = (n: number): void => {
    if (w.spunAt || iceOpen) return;
    const owner = ownerOfSlot(n);
    if (owner) {
      audio.sfx('back');
      setW((st) => {
        const picks = { ...st.picks };
        const extra = { ...(st.extra ?? {}) };
        if ((extra[owner.id] ?? []).includes(n)) extra[owner.id] = extra[owner.id].filter((x) => x !== n);
        else delete picks[owner.id];
        return { ...st, picks, extra };
      });
      return;
    }
    if (!pickingTeam) return;
    audio.sfx('click');
    const id = pickingTeam.id;
    setW((st) =>
      st.picks[id] ? { ...st, extra: { ...(st.extra ?? {}), [id]: [...(st.extra?.[id] ?? []), n] } } : { ...st, picks: { ...st.picks, [id]: n } },
    );
  };

  const iceVideoDone = (): void => setW((st) => (st.ice ? { ...st, ice: { ...st.ice, stage: 'offer' } } : st));

  const iceChoose = (accepted: boolean): void => {
    audio.sfx(accepted ? 'cheer' : 'click');
    setW((st) => (st.ice ? { ...st, ice: { ...st.ice, accepted } } : st));
  };

  const iceGo = (): void => {
    audio.sfx('whoosh');
    audio.resumeBackground();
    update((s) => {
      const st = s.wheel;
      if (!st?.ice || st.ice.accepted === undefined) return s;
      const iceTeams = st.ice.accepted && !(s.iceTeams ?? []).includes(st.ice.team) ? [...(s.iceTeams ?? []), st.ice.team] : s.iceTeams;
      return { ...s, iceTeams, wheel: { ...st, iceDone: true } };
    });
  };

  const startSpin = (result: number): void => {
    audio.sfx('rocket');
    const center = (result - 1) * SLOT_DEG + SLOT_DEG / 2;
    const jitter = (Math.random() - 0.5) * SLOT_DEG * 0.6;
    const target = (360 - center + jitter + 360) % 360;
    setW((st) => {
      const current = ((st.rotation % 360) + 360) % 360;
      const delta = (target - current + 360) % 360;
      return { ...st, result, spinning: true, spunAt: Date.now(), rotation: st.rotation + 360 * 6 + delta };
    });
  };

  const spin = (): void => startSpin(1 + Math.floor(Math.random() * SLOTS));

  const fakeReload = (): void => {
    setReloading(true);
    window.setTimeout(() => {
      setReloading(false);
      setFixLink(true);
    }, 1800);
  };

  const playFix = (): void => {
    setW((st) => ({ ...st, prank: 'video' }));
  };

  /** Video done: back to the wheel, music on, and the spin carries on to the same result. */
  const endPrank = (): void => {
    audio.resumeBackground();
    setW((st) => ({ ...st, prank: 'done' }));
    startSpin(w?.result ?? 1 + Math.floor(Math.random() * SLOTS));
  };

  const finish = (): void => {
    audio.sfx('whoosh');
    const result = buildResult(event, teams, {
      hits: hitTeams.map((t) => t.id),
      note: `Hjulet stoppet på ${w.result}${hitTeams.length ? '' : ' – ingen traff'}.${
        w.ice?.accepted ? ` ${iceTeam?.name ?? '?'} hadde ${1 + ICE_EXTRA_SLOTS} felt etter en Smirnoff Ice.` : ''
      }`,
    });
    update((s) => ({ ...s, results: [...s.results.filter((r) => r.eventId !== event.id), result], pending: undefined }));
    go({ name: 'event-points', index });
  };

  const winnerColors = hitTeams.length ? [hitTeams[0].color, '#fff', '#ffc53d'] : undefined;

  const host = window.location.host || 'project-tracker.intility.minato.intilitest.no';

  return (
    <div className="screen wheel">
      {w.prank === 'error' && (
        <Portal>
          <div className="netfail" role="alert">
            {reloading ? (
              <div className="netfail-reloading">
                <div className="netfail-spinner" />
              </div>
            ) : (
              <div className="netfail-body">
                <div className="netfail-icon" aria-hidden="true">
                  <span className="netfail-icon-eye" />
                  <span className="netfail-icon-eye" />
                  <span className="netfail-icon-mouth" />
                </div>
                <h1 className="netfail-title">Denne siden fungerer ikke</h1>
                <p className="netfail-text">
                  <strong>{host}</strong> sendte ingen data i tide, eller tilkoblingen til nettverket ble endret under lasting.
                </p>
                <ul className="netfail-list">
                  <li>Kontroller nettverkskablene, modemet og ruteren</li>
                  <li>Koble til Wi‑Fi på nytt</li>
                  <li>Kjør Windows Nettverksdiagnostikk</li>
                </ul>
                <p className="netfail-code">HTTP ERROR 404 · ERR_NETWORK_CHANGED</p>
                <div className="netfail-actions">
                  <button type="button" className="netfail-btn" onClick={fakeReload}>
                    Last inn på nytt
                  </button>
                  {fixLink && (
                    <button type="button" className="netfail-link" data-primary onClick={playFix}>
                      Trykk her for å løse problemet
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Portal>
      )}
      {w.prank === 'video' && (
        <Portal>
          <div className="netfail netfail-video">
            <video src={PRANK_VIDEO} autoPlay playsInline onEnded={endPrank} onError={endPrank} />
          </div>
        </Portal>
      )}
      {iceOpen && w.ice?.stage === 'video' && (
        <Portal>
          <div className="ice ice-video">
            <div className="ice-video-kicker">🍾 Ice-sangen er tilbake – siste sjanse i kveld</div>
            <div className="ice-video-frame">
              <video src={ICE_VIDEO} autoPlay playsInline onEnded={iceVideoDone} onError={iceVideoDone} />
            </div>
            <button type="button" className="startvideo-skip" onClick={iceVideoDone} title="Hopp over">
              Hopp over ›
            </button>
          </div>
        </Portal>
      )}
      {iceOpen && w.ice?.stage === 'offer' && iceTeam && (
        <Portal>
          <div className="ice ice-offer">
            <div className="ice-card" style={{ ['--team' as string]: iceTeam.color }}>
              <div className="ice-card-head">
                <span className="ice-card-emoji">🧊</span>
                <div>
                  <h1 className="ice-card-title">Siste Smirnoff Ice</h1>
                  <p className="ice-card-sub">Alle har valgt felt. Ett lag har ikke fått Ice-sjansen sin ennå.</p>
                </div>
              </div>
              <ol className="ice-rules">
                <li>
                  <b>
                    <TeamMark team={iceTeam} /> {iceTeam.name}
                  </b>{' '}
                  er det siste laget uten tilbud.
                </li>
                <li>
                  <b>Chug én Smirnoff Ice</b>, og laget får velge <b>{ICE_EXTRA_SLOTS} felt til</b> på hjulet – tre felt i stedet for ett, for en bedre sjanse på de{' '}
                  {event.points[0]} poengene.
                </li>
                <li>
                  <b>Sier dere nei</b>, snurrer hjulet som vanlig.
                </li>
              </ol>
              <div className="six-ice-choices">
                <button type="button" className={`btn btn-xl six-ice-yes ${w.ice.accepted === true ? 'six-ice-on' : ''}`} onClick={() => iceChoose(true)}>
                  🍾 Vi tar en Ice (+{ICE_EXTRA_SLOTS} felt)
                </button>
                <button type="button" className={`btn btn-ghost btn-xl ${w.ice.accepted === false ? 'six-ice-on' : ''}`} onClick={() => iceChoose(false)}>
                  Nei takk
                </button>
              </div>
              <button type="button" className="btn btn-primary btn-xl" data-primary disabled={w.ice.accepted === undefined} onClick={iceGo}>
                {w.ice.accepted ? 'Velg de ekstra feltene →' : 'Videre til hjulet →'}
              </button>
            </div>
          </div>
        </Portal>
      )}
      <Confetti active={landed && hitTeams.length > 0} burst colors={winnerColors} />
      <div className="wheel-layout">
        <div className="wheel-side">
          <h1 className="play-title">🎡 Wheel of Fortune</h1>
          {!w.spunAt && pickingTeam && (
            <p className="play-sub big">
              <span className="team-badge" style={{ ['--team' as string]: pickingTeam.color }}>
                <TeamMark team={pickingTeam} /> {pickingTeam.name}
              </span>{' '}
              velger {extraPending ? `ekstra felt 🧊 (${extraPlaced + 1} av ${ICE_EXTRA_SLOTS})` : 'felt'}
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
                    <TeamMark team={t} /> {t.name} traff! +{event.points[0]} poeng
                  </div>
                ))
              ) : (
                <div className="wheel-result-miss">Ingen traff. Hjulet er nådeløst.</div>
              )}
            </div>
          )}
          <div className="wheel-picks">
            {teams.map((t) => (
              <div key={t.id} className={`wheel-pick-row ${landed && slotsOf(t.id).includes(w.result!) ? 'wheel-pick-hit' : ''}`} style={{ ['--team' as string]: t.color }}>
                <span>
                  <TeamMark team={t} /> {t.name}
                </span>
                <strong>{slotsOf(t.id).length ? slotsOf(t.id).join(' + ') : '–'}</strong>
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
            ref={svgRef}
            className={`wheel-svg ${w.spinning ? 'wheel-spinning' : ''}`}
            viewBox={`${-R - 20} ${-R - 20} ${2 * R + 40} ${2 * R + 40}`}
            style={{ transform: `rotate(${w.rotation}deg)`, transition: w.spunAt ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.75, 0.08, 1)` : 'none' }}
          >
            <circle r={R + 14} fill="#2a1a08" stroke="#e0a62b" strokeWidth={6} />
            {Array.from({ length: SLOTS }).map((_, i) => {
              const n = i + 1;
              const owner = ownerOfSlot(n);
              const mid = i * SLOT_DEG + SLOT_DEG / 2;
              const [tx, ty] = polar(mid, R * 0.82);
              const [ix, iy] = polar(mid, R * 0.56);
              const ICON = 46;
              const isHit = landed && w.result === n;
              return (
                <g key={n} className={`wheel-slot ${owner ? 'wheel-slot-taken' : ''} ${isHit ? 'wheel-slot-hit' : ''}`} onClick={() => pick(n)}>
                  <path
                    d={sectorPath(i, R)}
                    fill={owner ? owner.color : SECTOR_COLORS[i % SECTOR_COLORS.length]}
                    stroke={owner ? '#fff' : '#f6d77a'}
                    strokeWidth={owner ? 3 : 1.5}
                  />
                  <text
                    x={tx}
                    y={ty}
                    fill={owner ? '#111' : '#fff'}
                    fontSize={owner ? 34 : 32}
                    fontWeight={900}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${mid} ${tx} ${ty})`}
                  >
                    {n}
                  </text>
                  {owner && (
                    // The team's icon on its own sector, so the picks are visible on the wheel itself.
                    <image
                      href={owner.icon ? iconSrc(owner.icon) : undefined}
                      x={ix - ICON / 2}
                      y={iy - ICON / 2}
                      width={ICON}
                      height={ICON}
                      transform={`rotate(${mid} ${ix} ${iy})`}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
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
