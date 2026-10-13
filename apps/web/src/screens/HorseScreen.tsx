import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { placementsFromGroups } from '../game/scoring';
import type { TeamId } from '../game/types';
import type { ScreenProps } from './common';

type Suit = '♠' | '♥' | '♦' | '♣';
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const SUIT_NAME: Record<Suit, string> = { '♠': 'Spar', '♥': 'Hjerter', '♦': 'Ruter', '♣': 'Kløver' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TRACK = 8;
const SIDE_CARDS = 7;

interface Card {
  suit: Suit;
  rank: string;
}

interface Race {
  stage: 'pick' | 'ready' | 'running' | 'paused' | 'finished';
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
    const id = window.setInterval(() => setRace((r) => (r.stage === 'running' ? step(r) : r)), fast ? 650 : 1200);
    return () => window.clearInterval(id);
  }, [race.stage, fast]);

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
    update((s) => ({
      ...s,
      pending: {
        placements: placementsFromGroups(groups),
        note: `Rekkefølgen er hentet fra løpet${tie ? ' (delte plasser deler poengene)' : ''}. Vinner: ${winnerTeam?.name ?? '?'}. Juster om nødvendig.`,
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

  return (
    <div className="screen horse">
      <Confetti active={race.stage === 'finished'} burst colors={winnerTeam ? [winnerTeam.color, '#fff', '#ffc53d'] : undefined} />

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

      {(race.stage === 'running' || race.stage === 'paused' || race.stage === 'finished') && (
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
                return (
                  <div key={t.id} className={`lane ${isWinner ? 'lane-winner' : ''}`} style={{ ['--team' as string]: t.color }}>
                    <div className="lane-label">
                      <span className={`lane-suit ${red ? 'red' : ''}`}>{suit}</span>
                      <span>
                        <TeamMark team={t} /> {t.name}
                      </span>
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
