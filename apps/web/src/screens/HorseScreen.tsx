import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Portal } from '../components/Portal';
import { placementsFromGroups } from '../game/scoring';
import type { Team, TeamId } from '../game/types';
import type { ScreenProps } from './common';

type Suit = '♠' | '♥' | '♦' | '♣';
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const SUIT_NAME: Record<Suit, string> = { '♠': 'Spar', '♥': 'Hjerter', '♦': 'Ruter', '♣': 'Kløver' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TRACK = 8;
const SIDE_CARDS = 7;

/**
 * The Smirnoff Ice steal: the first time a horse gets a bit past halfway the
 * race freezes, the teams in last place see an intro and the Teams video, and
 * may each chug a Smirnoff Ice to steal one point from the race winner.
 */
const STEAL_AT = 5;
const ICE_INTRO_MS = 5200;
const ICE_VIDEO = '/ice-video.mp4';

interface Card {
  suit: Suit;
  rank: string;
}

interface Steal {
  stage: 'intro' | 'video' | 'offer' | 'done';
  /** Team leading when the race was stopped. */
  leader: TeamId;
  /** Teams in last place when the race was stopped (one, or several on a tie). */
  thieves: TeamId[];
  /** Thieves that took the deal: a Smirnoff Ice for one point. */
  accepted: TeamId[];
  /** Thieves that said no (kept so the host sees everyone has answered). */
  declined: TeamId[];
}

interface Race {
  stage: 'pick' | 'ready' | 'running' | 'paused' | 'steal' | 'finished';
  /** Suit chosen by each team (index = team index). */
  picks: (Suit | undefined)[];
  positions: Record<Suit, number>;
  deck: Card[];
  side: Card[];
  sideFlipped: boolean[];
  current?: Card;
  flipKey: number;
  lastEvent?: string;
  winner?: Suit;
  /** The Smirnoff Ice stop; happens once per race. */
  steal?: Steal;
}

/** Who leads and who trails among the horses that belong to a team. */
function buildSteal(r: Race, teams: Team[]): Steal | undefined {
  const owned = teams.map((t, i) => ({ id: t.id, pos: r.picks[i] ? r.positions[r.picks[i]!] : -1 })).filter((o) => o.pos >= 0);
  if (owned.length < 2) return undefined;
  const top = Math.max(...owned.map((o) => o.pos));
  const bottom = Math.min(...owned.map((o) => o.pos));
  if (top === bottom) return undefined;
  const leader = owned.find((o) => o.pos === top)!.id;
  const thieves = owned.filter((o) => o.pos === bottom).map((o) => o.id);
  return { stage: 'intro', leader, thieves, accepted: [], declined: [] };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) cards.push({ suit, rank });
  return shuffle(cards);
}

function newRace(teamCount: number): Race {
  const deck = freshDeck();
  const side = deck.splice(0, SIDE_CARDS);
  return {
    stage: 'pick',
    picks: Array(teamCount).fill(undefined),
    positions: { '♠': 0, '♥': 0, '♦': 0, '♣': 0 },
    deck,
    side,
    sideFlipped: Array(SIDE_CARDS).fill(false),
    flipKey: 0,
  };
}

function step(r: Race): Race {
  const due = r.sideFlipped.findIndex((f) => !f);
  if (due !== -1 && SUITS.every((s) => r.positions[s] >= due + 1)) {
    const card = r.side[due];
    const positions = { ...r.positions, [card.suit]: Math.max(0, r.positions[card.suit] - 1) };
    const sideFlipped = [...r.sideFlipped];
    sideFlipped[due] = true;
    return { ...r, positions, sideFlipped, current: card, flipKey: r.flipKey + 1, lastEvent: `side:${card.suit}` };
  }
  let deck = r.deck;
  if (deck.length === 0) deck = freshDeck().filter((c) => !r.side.some((s) => s.suit === c.suit && s.rank === c.rank));
  const [card, ...rest] = deck;
  const positions = { ...r.positions, [card.suit]: r.positions[card.suit] + 1 };
  const winner = positions[card.suit] >= TRACK ? card.suit : undefined;
  return {
    ...r,
    deck: rest,
    positions,
    current: card,
    flipKey: r.flipKey + 1,
    lastEvent: `draw:${card.suit}`,
    winner,
    stage: winner ? 'finished' : r.stage,
  };
}

function PlayingCard({ card, faceUp, big = false, flipKey }: { card?: Card; faceUp: boolean; big?: boolean; flipKey?: number }) {
  const red = card?.suit === '♥' || card?.suit === '♦';
  return (
    <div key={flipKey} className={`pcard ${big ? 'pcard-big' : ''} ${faceUp ? 'pcard-up' : 'pcard-down'} ${red ? 'pcard-red' : ''}`}>
      <div className="pcard-inner">
        <div className="pcard-back" />
        <div className="pcard-face">
          {card && (
            <>
              <span className="pcard-rank">{card.rank}</span>
              <span className="pcard-suit">{card.suit}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function HorseScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const teams = state.teams;
  const [race, setRace] = useState<Race>(() => newRace(teams.length));
  const [fast, setFast] = useState(false);
  const finishedRef = useRef(false);

  const suitOfTeam = (i: number): Suit | undefined => race.picks[i];
  const teamOfSuit = (s: Suit): TeamId | undefined => teams[race.picks.indexOf(s)]?.id;
  const pickingIndex = race.picks.findIndex((p) => !p);
  const pickingTeam = pickingIndex >= 0 ? teams[pickingIndex] : undefined;

  useEffect(() => {
    audio.playMusic('gallop');
  }, []);

  useEffect(() => {
    if (race.stage !== 'running') return;
    const id = window.setInterval(
      () =>
        setRace((r) => {
          if (r.stage !== 'running') return r;
          const next = step(r);
          // A bit past halfway for the first time: freeze the race for the Smirnoff Ice offer.
          if (!next.steal && !next.winner && SUITS.some((s) => next.positions[s] >= STEAL_AT)) {
            const steal = buildSteal(next, teams);
            if (steal) return { ...next, stage: 'steal', steal };
          }
          return next;
        }),
      fast ? 650 : 1200,
    );
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.stage, fast]);

  const setSteal = (patch: Partial<Steal>): void => setRace((r) => (r.steal ? { ...r, steal: { ...r.steal, ...patch } } : r));

  // The intro: backing track off, a few stings, then the video takes over.
  useEffect(() => {
    if (race.stage !== 'steal' || race.steal?.stage !== 'intro') return;
    audio.pauseBackground();
    audio.sfx('riser');
    const timers = [
      window.setTimeout(() => audio.sfx('crash'), 700),
      window.setTimeout(() => audio.sfx('sting'), 2000),
      window.setTimeout(() => audio.sfx('bell'), 3300),
      window.setTimeout(() => audio.sfx('whoosh'), 4600),
      window.setTimeout(() => setSteal({ stage: 'video' }), ICE_INTRO_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.stage, race.steal?.stage]);

  // Leaving the race mid-stop (host panel, reset) must not leave the music held.
  useEffect(() => () => audio.resumeBackground(), []);

  /** Video done (or failed): the music is back and the offer is on the table. */
  const videoDone = (): void => {
    if (race.steal?.stage !== 'video') return;
    audio.resumeBackground();
    audio.sfx('ding');
    setSteal({ stage: 'offer' });
  };

  const answer = (teamId: TeamId, yes: boolean): void => {
    audio.sfx(yes ? 'coin' : 'back');
    setRace((r) => {
      if (!r.steal) return r;
      const accepted = r.steal.accepted.filter((id) => id !== teamId);
      const declined = r.steal.declined.filter((id) => id !== teamId);
      (yes ? accepted : declined).push(teamId);
      return { ...r, steal: { ...r.steal, accepted, declined } };
    });
  };

  const resumeRace = (): void => {
    audio.sfx('rocket');
    setRace((r) => (r.steal ? { ...r, stage: 'running', steal: { ...r.steal, stage: 'done' } } : r));
  };

  useEffect(() => {
    if (!race.lastEvent) return;
    if (race.lastEvent.startsWith('side')) {
      audio.sfx('flip');
      window.setTimeout(() => audio.sfx('fail'), 150);
    } else {
      audio.sfx('flip');
      window.setTimeout(() => audio.sfx('hoof'), 120);
    }
  }, [race.flipKey, race.lastEvent]);

  useEffect(() => {
    if (race.stage !== 'finished' || finishedRef.current) return;
    finishedRef.current = true;
    audio.sfx('cheer');
    window.setTimeout(() => audio.sfx('fanfare'), 500);
    window.setTimeout(() => audio.playMusic('victory'), 900);

    const groups: TeamId[][] = [];
    const sorted = [...SUITS].sort((a, b) => race.positions[b] - race.positions[a]);
    let prevPos = -1;
    for (const s of sorted) {
      const teamId = teamOfSuit(s);
      if (!teamId) continue;
      if (race.positions[s] === prevPos) groups[groups.length - 1].push(teamId);
      else groups.push([teamId]);
      prevPos = race.positions[s];
    }
    const winnerTeam = teams.find((t) => t.id === teamOfSuit(race.winner!));
    const tie = groups.some((g) => g.length > 1);
    // The Smirnoff Ice steal: each thief that chugged takes one point from the race winner.
    const thieves = (race.steal?.accepted ?? []).filter((id) => id !== winnerTeam?.id);
    let adjust: Record<TeamId, number> | undefined;
    if (winnerTeam && thieves.length) {
      adjust = {};
      for (const id of thieves) adjust[id] = (adjust[id] ?? 0) + 1;
      adjust[winnerTeam.id] = (adjust[winnerTeam.id] ?? 0) - thieves.length;
    }
    const stealNote = thieves.length
      ? ` ${thieves.map((id) => teams.find((t) => t.id === id)?.name ?? '?').join(' og ')} chugget en Smirnoff Ice og stjal 1 poeng fra ${winnerTeam?.name ?? '?'}.`
      : '';
    update((s) => ({
      ...s,
      pending: {
        placements: placementsFromGroups(groups),
        adjust,
        note: `Rekkefølgen er hentet fra løpet${tie ? ' (delte plasser deler poengene)' : ''}. Vinner: ${winnerTeam?.name ?? '?'}.${stealNote} Juster om nødvendig.`,
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.stage]);

  const pickSuit = (suit: Suit): void => {
    setRace((r) => {
      const picks = [...r.picks];
      const owner = picks.indexOf(suit);
      if (owner !== -1) {
        // Clicking a taken horse frees it again (that team picks anew).
        audio.sfx('back');
        picks[owner] = undefined;
        return { ...r, picks, stage: 'pick' };
      }
      const next = picks.findIndex((p) => !p);
      if (next === -1) return r;
      audio.sfx('flip');
      picks[next] = suit;
      const allPicked = picks.every(Boolean);
      return { ...r, picks, stage: allPicked ? 'ready' : 'pick' };
    });
  };

  const randomRest = (): void => {
    audio.sfx('whoosh');
    setRace((r) => {
      const picks = [...r.picks];
      const free = shuffle(SUITS.filter((s) => !picks.includes(s)));
      for (let i = 0; i < picks.length; i++) if (!picks[i]) picks[i] = free.pop();
      return { ...r, picks, stage: picks.every(Boolean) ? 'ready' : 'pick' };
    });
  };

  const winnerTeam = race.winner ? teams.find((t) => t.id === teamOfSuit(race.winner!)) : undefined;
  const teamById = (id: TeamId): Team | undefined => teams.find((t) => t.id === id);
  const steal = race.steal;
  const leaderTeam = steal ? teamById(steal.leader) : undefined;
  const thiefTeams = steal ? steal.thieves.map(teamById).filter((t): t is Team => !!t) : [];
  const chuggers = steal ? steal.accepted.map(teamById).filter((t): t is Team => !!t) : [];
  const allAnswered = !!steal && steal.thieves.every((id) => steal.accepted.includes(id) || steal.declined.includes(id));
  const stealOpen = race.stage === 'steal' && !!steal && steal.stage !== 'done';
  const stolenFromWinner = chuggers.filter((t) => t.id !== winnerTeam?.id);

  return (
    <div className="screen horse">
      <Confetti active={race.stage === 'finished'} burst colors={winnerTeam ? [winnerTeam.color, '#fff', '#ffc53d'] : undefined} />

      {stealOpen && steal.stage === 'intro' && (
        <Portal>
          <div className="ice ice-intro" aria-live="polite">
            <div className="ice-flash" aria-hidden="true" />
            <div className="ice-stop">🚨 STOPP LØPET! 🚨</div>
            <div className="ice-line ice-line-1">
              <span className="team-badge" style={{ ['--team' as string]: leaderTeam?.color }}>
                {leaderTeam && <TeamMark team={leaderTeam} />} {leaderTeam?.name}
              </span>{' '}
              er over halvveis…
            </div>
            <div className="ice-line ice-line-2">
              …og sisteplassen{' '}
              {thiefTeams.map((t) => (
                <span key={t.id} className="team-badge" style={{ ['--team' as string]: t.color }}>
                  <TeamMark team={t} /> {t.name}
                </span>
              ))}{' '}
              får en melding fra ledelsen
            </div>
            <div className="ice-bottle-wrap" aria-hidden="true">
              <span className="ice-cube ice-cube-1">🧊</span>
              <span className="ice-cube ice-cube-2">🧊</span>
              <span className="ice-cube ice-cube-3">🧊</span>
              <div className="ice-bottle">
                <span className="ice-bottle-cap" />
                <span className="ice-bottle-neck" />
                <span className="ice-bottle-body">
                  <span className="ice-bottle-label">
                    <b>SMIRNOFF</b>
                    <i>ICE</i>
                  </span>
                </span>
              </div>
            </div>
            <div className="ice-title">SMIRNOFF ICE CHALLENGE</div>
          </div>
        </Portal>
      )}

      {stealOpen && steal.stage === 'video' && (
        <Portal>
          <div className="ice ice-video">
            <div className="ice-video-kicker">🍾 Chug-instruks fra ledelsen</div>
            <div className="ice-video-frame">
              <video src={ICE_VIDEO} autoPlay playsInline onEnded={videoDone} onError={videoDone} />
            </div>
            <button type="button" className="startvideo-skip" onClick={videoDone} title="Hopp over">
              Hopp over ›
            </button>
          </div>
        </Portal>
      )}

      {stealOpen && steal.stage === 'offer' && (
        <Portal>
          <div className="ice ice-offer">
            <div className="ice-card">
              <div className="ice-card-head">
                <span className="ice-card-emoji">🧊</span>
                <div>
                  <h1 className="ice-card-title">Smirnoff Ice-regelen</h1>
                  <p className="ice-card-sub">
                    Løpet er stoppet. Sisteplassen får ett tilbud før hestene løper videre.
                  </p>
                </div>
              </div>
              <ol className="ice-rules">
                <li>
                  <b>Chug én Smirnoff Ice.</b> Hele flaska, på ett kne, mens resten teller.
                </li>
                <li>
                  <b>Da stjeler dere 1 poeng</b> fra laget som vinner løpet, og tar det selv.
                </li>
                <li>
                  <b>Sier dere nei</b>, fortsetter løpet som før. Ingen skam. (Litt skam.)
                </li>
              </ol>
              <div className="ice-thieves">
                {thiefTeams.map((t) => {
                  const yes = steal.accepted.includes(t.id);
                  const no = steal.declined.includes(t.id);
                  return (
                    <div key={t.id} className={`ice-thief ${yes ? 'ice-thief-yes' : ''} ${no ? 'ice-thief-no' : ''}`} style={{ ['--team' as string]: t.color }}>
                      <span className="team-badge">
                        <TeamMark team={t} /> {t.name}
                      </span>
                      <div className="ice-thief-actions">
                        <button type="button" className={`btn ${yes ? 'btn-primary' : 'btn-ghost'}`} onClick={() => answer(t.id, true)}>
                          🍾 Vi chugger! (+1 poeng)
                        </button>
                        <button type="button" className={`btn ${no ? 'btn-primary' : 'btn-ghost'}`} onClick={() => answer(t.id, false)}>
                          🙅 Nei takk
                        </button>
                      </div>
                      {yes && <span className="ice-thief-verdict">Skål! 1 poeng flyttes fra vinneren til dere.</span>}
                      {no && <span className="ice-thief-verdict">Løpet går videre uten stjeling.</span>}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn-primary btn-xl" data-primary disabled={!allAnswered} onClick={resumeRace}>
                {allAnswered ? 'Fortsett løpet ▶' : 'Velg for alle lagene først'}
              </button>
            </div>
          </div>
        </Portal>
      )}

      {(race.stage === 'pick' || race.stage === 'ready') && (
        <div className="horse-draw">
          <h1 className="play-title">🐎 Velg hest</h1>
          {pickingTeam ? (
            <p className="play-sub big" style={{ ['--team' as string]: pickingTeam.color }}>
              <span className="team-badge">
                <TeamMark team={pickingTeam} /> {pickingTeam.name}
              </span>{' '}
              velger hest. Trykk på hesten laget vil ha.
            </p>
          ) : (
            <p className="play-sub">Alle lagene har valgt. Trykk på en hest for å bytte.</p>
          )}
          <div className="horse-pick-row">
            {SUITS.map((suit) => {
              const ownerIndex = race.picks.indexOf(suit);
              const owner = ownerIndex >= 0 ? teams[ownerIndex] : undefined;
              const red = suit === '♥' || suit === '♦';
              return (
                <button
                  key={suit}
                  className={`horse-pick ${owner ? 'horse-pick-taken' : ''}`}
                  style={{ ['--team' as string]: owner?.color ?? 'rgba(255,255,255,0.2)' }}
                  onClick={() => pickSuit(suit)}
                >
                  <span className="horse-pick-horse">🐎</span>
                  <span className={`horse-pick-suit ${red ? 'red' : ''}`}>{suit}</span>
                  <span className="horse-pick-name">{SUIT_NAME[suit]}</span>
                  <span className="horse-pick-owner">{owner ? `${owner.name}` : 'Ledig'}</span>
                </button>
              );
            })}
          </div>
          <div className="rank-actions">
            {race.stage === 'pick' && (
              <button className="btn btn-ghost" onClick={randomRest}>
                🎲 Trekk tilfeldig for resten
              </button>
            )}
            {race.stage === 'ready' && (
              <button
                className="btn btn-primary btn-xl btn-start"
                data-primary
                onClick={() => {
                  audio.sfx('rocket');
                  setRace((r) => ({ ...r, stage: 'running' }));
                }}
              >
                START LØPET!
              </button>
            )}
          </div>
        </div>
      )}

      {(race.stage === 'running' || race.stage === 'paused' || race.stage === 'steal' || race.stage === 'finished') && (
        <div className="race">
          <div className="race-side">
            <div className="race-side-label">Sidekort</div>
            <div className="race-side-cards">
              {race.side.map((c, k) => (
                <div key={k} className="race-side-slot" style={{ ['--col' as string]: k + 1 }}>
                  <PlayingCard card={c} faceUp={race.sideFlipped[k]} flipKey={race.sideFlipped[k] ? 1 : 0} />
                </div>
              ))}
            </div>
          </div>

          <div className="race-track">
            <div className="race-stand" aria-hidden="true">
              <span className="race-stand-sign">🏟 TRAVBANEN</span>
            </div>
            <div className="race-lanes">
              {teams.map((t, i) => {
                const suit = suitOfTeam(i);
                if (!suit) return null;
                const pos = race.positions[suit];
                const red = suit === '♥' || suit === '♦';
                const isWinner = race.winner === suit;
                const chugged = chuggers.some((c) => c.id === t.id);
                return (
                  <div key={t.id} className={`lane ${isWinner ? 'lane-winner' : ''}`} style={{ ['--team' as string]: t.color }}>
                    <div className="lane-label">
                      <span className={`lane-suit ${red ? 'red' : ''}`}>{suit}</span>
                      <span>
                        <TeamMark team={t} /> {t.name}
                      </span>
                      {chugged && (
                        <span className="lane-ice" title="Chugget en Smirnoff Ice: stjeler 1 poeng fra vinneren">
                          🧊 +1
                        </span>
                      )}
                    </div>
                    <div className="lane-path">
                      {Array.from({ length: TRACK + 1 }).map((_, k) => (
                        <span key={k} className={`lane-mark ${k === TRACK ? 'lane-finish' : ''}`} style={{ ['--col' as string]: k }}>
                          {k > 0 && k < TRACK && <i className="lane-post">{k}</i>}
                        </span>
                      ))}
                      <div className={`horse-runner ${race.stage === 'running' ? 'galloping' : ''}`} style={{ ['--pos' as string]: pos / TRACK }}>
                        <span className="horse-dust" />
                        <span className="horse-emoji">🐎</span>
                        <span className="horse-tag"><TeamMark team={t} /></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="race-rail" aria-hidden="true" />
          </div>

          <div className="race-deck">
            <div className="race-deck-label">{race.stage === 'finished' ? 'Mål!' : 'Trukket kort'}</div>
            <PlayingCard card={race.current} faceUp={!!race.current} big flipKey={race.flipKey} />
            <div className="race-deck-count">{race.deck.length} kort igjen</div>
            {race.lastEvent?.startsWith('side') && race.stage !== 'finished' && (
              <div className="race-callout">Sidekort! {race.current?.suit} rygger ett steg</div>
            )}
            {race.stage !== 'finished' && (
              <div className="race-controls">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setRace((r) => ({ ...r, stage: r.stage === 'paused' ? 'running' : 'paused' }))}
                >
                  {race.stage === 'paused' ? '▶ Fortsett' : '⏸ Pause'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setFast((f) => !f)}>
                  {fast ? '🐢 Normal fart' : '⚡ Raskere'}
                </button>
              </div>
            )}
          </div>

          {race.stage === 'finished' && winnerTeam && (
            <div className="race-winner" style={{ ['--team' as string]: winnerTeam.color }}>
              <div className="race-winner-text">
                🏁 <TeamMark team={winnerTeam} /> {winnerTeam.name} vant løpet!
                {stolenFromWinner.length > 0 && (
                  <span className="race-winner-steal">
                    🧊 {stolenFromWinner.map((t) => t.name).join(' og ')} chugget og stjeler {stolenFromWinner.length} poeng fra {winnerTeam.name}
                  </span>
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
                Til resultat →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
