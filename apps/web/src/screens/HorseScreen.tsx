import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { placementsFromGroups } from '../game/scoring';
import type { TeamId } from '../game/types';
import type { ScreenProps } from './common';

type Suit = '♠' | '♥' | '♦' | '♣';
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TRACK = 8;
const SIDE_CARDS = 7;

interface Card {
  suit: Suit;
  rank: string;
}

interface Race {
  stage: 'draw' | 'drawing' | 'ready' | 'running' | 'paused' | 'finished';
  drawOrder: Suit[];
  revealed: number;
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

function newRace(): Race {
  const deck = freshDeck();
  const side = deck.splice(0, SIDE_CARDS);
  return {
    stage: 'draw',
    drawOrder: shuffle(SUITS),
    revealed: 0,
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
  const [race, setRace] = useState<Race>(newRace);
  const [fast, setFast] = useState(false);
  const finishedRef = useRef(false);

  const suitOfTeam = (i: number): Suit => race.drawOrder[i % 4];
  const teamOfSuit = (s: Suit): TeamId | undefined => teams[race.drawOrder.indexOf(s)]?.id;

  useEffect(() => {
    audio.playMusic('gallop');
  }, []);

  useEffect(() => {
    if (race.stage !== 'drawing') return;
    const id = window.setInterval(() => {
      audio.sfx('flip');
      setRace((r) => {
        const revealed = r.revealed + 1;
        return { ...r, revealed, stage: revealed >= 4 ? 'ready' : 'drawing' };
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [race.stage]);

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

  const winnerTeam = race.winner ? teams.find((t) => t.id === teamOfSuit(race.winner!)) : undefined;

  return (
    <div className="screen horse">
      <Confetti active={race.stage === 'finished'} burst colors={winnerTeam ? [winnerTeam.color, '#fff', '#ffc53d'] : undefined} />

      {(race.stage === 'draw' || race.stage === 'drawing' || race.stage === 'ready') && (
        <div className="horse-draw">
          <h1 className="play-title">🐎 Trekning av hester</h1>
          <p className="play-sub">Hvert lag får en hest – kortfargen bestemmer hvem som er hvem.</p>
          <div className="horse-draw-row">
            {teams.map((t, i) => {
              const up = i < race.revealed;
              const suit = suitOfTeam(i);
              return (
                <div key={t.id} className="horse-draw-card" style={{ ['--team' as string]: t.color }}>
                  <div className="horse-draw-team">
                    {t.emoji} {t.name}
                  </div>
                  <PlayingCard card={{ suit, rank: 'A' }} faceUp={up} big flipKey={up ? 1 : 0} />
                </div>
              );
            })}
          </div>
          {race.stage === 'draw' && (
            <button
              className="btn btn-primary btn-xl"
              data-primary
              onClick={() => {
                audio.sfx('click');
                setRace((r) => ({ ...r, stage: 'drawing' }));
              }}
            >
              Trekk hester
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
            {teams.map((t, i) => {
              const suit = suitOfTeam(i);
              const pos = race.positions[suit];
              const red = suit === '♥' || suit === '♦';
              const isWinner = race.winner === suit;
              return (
                <div key={t.id} className={`lane ${isWinner ? 'lane-winner' : ''}`} style={{ ['--team' as string]: t.color }}>
                  <div className="lane-label">
                    <span className={`lane-suit ${red ? 'red' : ''}`}>{suit}</span>
                    <span>
                      {t.emoji} {t.name}
                    </span>
                  </div>
                  <div className="lane-path">
                    {Array.from({ length: TRACK + 1 }).map((_, k) => (
                      <span key={k} className={`lane-mark ${k === TRACK ? 'lane-finish' : ''}`} style={{ ['--col' as string]: k }} />
                    ))}
                    <div className={`horse-runner ${race.stage === 'running' ? 'galloping' : ''}`} style={{ ['--pos' as string]: pos / TRACK }}>
                      <span className="horse-emoji">🐎</span>
                      <span className="horse-tag">{t.emoji}</span>
                    </div>
                  </div>
                </div>
              );
            })}
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
                🏁 {winnerTeam.emoji} {winnerTeam.name} vant løpet!
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
