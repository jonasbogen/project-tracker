import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { HorseFigure, HORSE_NAME } from '../components/HorseFigure';
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
 * may each chug a Smirnoff Ice to take one field from the leader. The transfer
 * is then played out on the track, one move at a time, before the race goes on.
 */
const STEAL_AT = 5;
const ICE_INTRO_MS = 5200;
const ICE_VIDEO = '/ice-video.mp4';
/**
 * The race music: the sound of the user's own clip (The Lone Ranger Theme,
 * 1:42, looped), starting on "START LØPET!" and running until the screen is
 * left. Only the sound, never the picture. Only in the horse race. It stops
 * for the Smirnoff Ice intro and video and picks up where it was afterwards.
 */
const RACE_MUSIC = '/start-race.m4a';
/** The transfer: a beat before the first move, a beat between moves, and a hold at the end. */
const TRANSFER_FIRST_MS = 1600;
const TRANSFER_STEP_MS = 1300;
const TRANSFER_HOLD_MS = 2200;

interface Card {
  suit: Suit;
  rank: string;
}

/** One move of the transfer: the leader backs a field (−1) or a chugger goes a field ahead (+1). */
interface Move {
  teamId: TeamId;
  delta: 1 | -1;
}

interface Steal {
  stage: 'intro' | 'video' | 'offer' | 'transfer' | 'done';
  /** Team leading when the race was stopped. */
  leader: TeamId;
  /** Teams in last place when the race was stopped (one, or several on a tie). */
  thieves: TeamId[];
  /** Thieves that took the deal: a Smirnoff Ice for one field. */
  accepted: TeamId[];
  /** Thieves that said no (kept so the host sees everyone has answered). */
  declined: TeamId[];
  /** The moves of the transfer, played one by one on the track. */
  moves: Move[];
  /** How many of `moves` have been played. */
  played: number;
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
  return { stage: 'intro', leader, thieves, accepted: [], declined: [], moves: [], played: 0 };
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

  // The race music, and where it was when the Ice stop silenced it.
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicOffsetRef = useRef(0);
  const startMusic = (offset = 0): void => {
    musicRef.current = audio.playTrack(RACE_MUSIC, true, { offset });
  };
  const haltMusic = (): void => {
    musicOffsetRef.current = musicRef.current?.currentTime ?? 0;
    musicRef.current = null;
    audio.stopTrack(false);
  };

  // The intro: race music and backing track off, a few stings, then the video takes over.
  useEffect(() => {
    if (race.stage !== 'steal' || race.steal?.stage !== 'intro') return;
    haltMusic();
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

  // Leaving the race (host panel, reset, "Til resultat") hands the sound back to the backing track.
  useEffect(
    () => () => {
      audio.stopTrack(false);
      audio.resumeBackground();
    },
    [],
  );

  /** Video done (or failed): the race music picks up where it stopped and the offer is on the table. */
  const videoDone = (): void => {
    if (race.steal?.stage !== 'video') return;
    startMusic(musicOffsetRef.current);
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

  /**
   * "Fortsett løpet": with no chuggers the horses just run on. Otherwise the
   * transfer is played on the track first: for every chugger the leader backs
   * one field and the chugger goes one field ahead.
   */
  const resumeRace = (): void => {
    setRace((r) => {
      if (!r.steal) return r;
      const chuggers = r.steal.accepted.filter((id) => id !== r.steal!.leader);
      if (!chuggers.length) {
        audio.sfx('rocket');
        return { ...r, stage: 'running', steal: { ...r.steal, stage: 'done' } };
      }
      audio.sfx('sting');
      const moves: Move[] = [];
      for (const id of chuggers) moves.push({ teamId: r.steal.leader, delta: -1 }, { teamId: id, delta: 1 });
      return { ...r, steal: { ...r.steal, stage: 'transfer', moves, played: 0 } };
    });
  };

  // The transfer itself: one move per beat, then a short hold, then the race runs on.
  useEffect(() => {
    if (race.stage !== 'steal' || race.steal?.stage !== 'transfer') return;
    const { moves, played } = race.steal;
    if (played >= moves.length) {
      const t = window.setTimeout(() => {
        audio.sfx('rocket');
        setRace((r) => (r.steal?.stage === 'transfer' ? { ...r, stage: 'running', steal: { ...r.steal, stage: 'done' } } : r));
      }, TRANSFER_HOLD_MS);
      return () => window.clearTimeout(t);
    }
    const move = moves[played];
    const t = window.setTimeout(() => {
      if (move.delta < 0) {
        audio.sfx('fail');
        window.setTimeout(() => audio.sfx('boo'), 150);
      } else {
        audio.sfx('coin');
        window.setTimeout(() => audio.sfx('hoof'), 150);
      }
      setRace((r) => {
        if (r.steal?.stage !== 'transfer' || r.steal.played !== played) return r;
        const suit = r.picks[teams.findIndex((t) => t.id === move.teamId)];
        const positions = suit
          ? { ...r.positions, [suit]: Math.max(0, Math.min(TRACK - 1, r.positions[suit] + move.delta)) }
          : r.positions;
        return { ...r, positions, steal: { ...r.steal, played: played + 1 } };
      });
    }, played === 0 ? TRANSFER_FIRST_MS : TRANSFER_STEP_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.stage, race.steal?.stage, race.steal?.played]);

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
    // The Smirnoff Ice steal was played out on the track; the placements already include it.
    const chugged = (race.steal?.accepted ?? []).filter((id) => id !== race.steal?.leader);
    const leaderName = teams.find((t) => t.id === race.steal?.leader)?.name ?? '?';
    const stealNote = chugged.length
      ? ` ${chugged.map((id) => teams.find((t) => t.id === id)?.name ?? '?').join(' og ')} chugget en Smirnoff Ice underveis og tok ${chugged.length === 1 ? 'ett felt' : `${chugged.length} felt`} fra ${leaderName}.`
      : '';
    update((s) => ({
      ...s,
      // Remembered for the rest of the night: who chugged, and who has had their Ice chance.
      iceTeams: chugged,
      iceOffered: race.steal?.thieves ?? [],
      pending: {
        placements: placementsFromGroups(groups),
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
  const chuggers = steal ? steal.accepted.map(teamById).filter((t): t is Team => !!t && t.id !== steal.leader) : [];
  const allAnswered = !!steal && steal.thieves.every((id) => steal.accepted.includes(id) || steal.declined.includes(id));
  const stealOpen = race.stage === 'steal' && !!steal && steal.stage !== 'done';
  const transferring = race.stage === 'steal' && steal?.stage === 'transfer';
  const played = transferring ? steal.played : 0;
  const lastMove = transferring && played > 0 ? steal.moves[played - 1] : undefined;
  const transferDone = transferring && played >= steal.moves.length;

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
                  <b>Da stjeler dere ett felt</b> fra lederen, her og nå: {leaderTeam?.name ?? 'lederen'} rygger ett felt på banen, og hesten deres går ett felt frem. Ingen poeng byttes etter målgang.
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
                          🍾 Vi chugger! (+1 felt)
                        </button>
                        <button type="button" className={`btn ${no ? 'btn-primary' : 'btn-ghost'}`} onClick={() => answer(t.id, false)}>
                          🙅 Nei takk
                        </button>
                      </div>
                      {yes && (
                        <span className="ice-thief-verdict">
                          Skål! {leaderTeam?.name ?? 'Lederen'} rygger ett felt og dere går ett felt frem.
                        </span>
                      )}
                      {no && <span className="ice-thief-verdict">Løpet går videre uten stjeling.</span>}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn-primary btn-xl" data-primary disabled={!allAnswered} onClick={resumeRace}>
                {!allAnswered ? 'Velg for alle lagene først' : chuggers.length ? '🧊 Flytt hestene og fortsett ▶' : 'Fortsett løpet ▶'}
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
                  <span className="horse-pick-horse">
                    <HorseFigure suit={suit} />
                  </span>
                  <span className={`horse-pick-suit ${red ? 'red' : ''}`}>{suit}</span>
                  <span className="horse-pick-name">
                    {SUIT_NAME[suit]} · «{HORSE_NAME[suit]}»
                  </span>
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
                  startMusic();
                  setRace((r) => (r.stage === 'ready' ? { ...r, stage: 'running' } : r));
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
                const isLeader = transferring && steal.leader === t.id;
                const isThief = transferring && chugged;
                // Floating −1/+1 over the horse for every move of the transfer this team has had.
                const floats = transferring ? steal.moves.slice(0, played).map((m, k) => ({ ...m, k })).filter((m) => m.teamId === t.id) : [];
                const justMoved = lastMove?.teamId === t.id ? lastMove.delta : 0;
                return (
                  <div
                    key={t.id}
                    className={`lane ${isWinner ? 'lane-winner' : ''} ${isLeader ? 'lane-steal-loser' : ''} ${isThief ? 'lane-steal-thief' : ''}`}
                    style={{ ['--team' as string]: t.color }}
                  >
                    <div className="lane-label">
                      <span className={`lane-suit ${red ? 'red' : ''}`}>{suit}</span>
                      <span>
                        <TeamMark team={t} /> {t.name}
                      </span>
                      {chugged && (
                        <span className="lane-ice" title="Chugget en Smirnoff Ice: tok ett felt fra lederen">
                          🧊 +1
                        </span>
                      )}
                      {isLeader && (
                        <span className="lane-ice lane-ice-loser" title="Blir frastjålet felt">
                          🧊 −{chuggers.length}
                        </span>
                      )}
                    </div>
                    <div className="lane-path">
                      {Array.from({ length: TRACK + 1 }).map((_, k) => (
                        <span key={k} className={`lane-mark ${k === TRACK ? 'lane-finish' : ''}`} style={{ ['--col' as string]: k }}>
                          {k > 0 && k < TRACK && <i className="lane-post">{k}</i>}
                        </span>
                      ))}
                      <div
                        className={`horse-runner ${race.stage === 'running' ? 'galloping' : ''} ${justMoved < 0 ? 'stumbling' : ''} ${justMoved > 0 ? 'hopping' : ''}`}
                        style={{ ['--pos' as string]: pos / TRACK }}
                      >
                        <span className="horse-dust" />
                        <span key={played} className="horse-emoji">
                          <HorseFigure suit={suit} />
                        </span>
                        <span className="horse-tag"><TeamMark team={t} /></span>
                        {floats.map((m, n) => (
                          <span key={m.k} className={`steal-float ${m.delta < 0 ? 'steal-float-minus' : 'steal-float-plus'}`} style={{ ['--n' as string]: n }}>
                            {m.delta < 0 ? '−1' : '+1'}
                          </span>
                        ))}
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
            {transferring && <div className="race-callout race-callout-ice">🧊 Stjeling pågår…</div>}
            {race.stage !== 'finished' && race.stage !== 'steal' && (
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

          {transferring && (
            <div className="race-steal" style={{ ['--team' as string]: leaderTeam?.color }}>
              <div className="race-steal-head">
                <span className="race-steal-title">🧊 SMIRNOFF ICE-STJELING!</span>
                <span className="race-steal-sub">
                  {chuggers.map((t) => t.name).join(' og ')} chugget. {leaderTeam?.name ?? 'Lederen'} rygger{' '}
                  {chuggers.length === 1 ? 'ett felt' : `${chuggers.length} felt`}.
                </span>
              </div>
              <div className="race-steal-moves">
                {steal.moves.map((m, k) => {
                  const team = teamById(m.teamId);
                  const state = k < played - 1 ? 'done' : k === played - 1 ? 'now' : 'next';
                  return (
                    <span
                      key={k}
                      className={`race-steal-move race-steal-move-${state} ${m.delta < 0 ? 'race-steal-move-minus' : 'race-steal-move-plus'}`}
                      style={{ ['--team' as string]: team?.color }}
                    >
                      {team && <TeamMark team={team} />} {team?.name} <b>{m.delta < 0 ? '−1 felt' : '+1 felt'}</b>
                    </span>
                  );
                })}
              </div>
              <div className={`race-steal-foot ${transferDone ? 'race-steal-foot-go' : ''}`}>
                {transferDone ? '🐎 Løpet fortsetter!' : 'Se på banen…'}
              </div>
            </div>
          )}

          {race.stage === 'finished' && winnerTeam && (
            <div className="race-winner" style={{ ['--team' as string]: winnerTeam.color }}>
              <div className="race-winner-text">
                🏁 <TeamMark team={winnerTeam} /> {winnerTeam.name} vant løpet!
                {chuggers.length > 0 && (
                  <span className="race-winner-steal">
                    🧊 {chuggers.map((t) => t.name).join(' og ')} chugget underveis og tok {chuggers.length === 1 ? 'ett felt' : `${chuggers.length} felt`} fra{' '}
                    {leaderTeam?.name ?? 'lederen'}
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
