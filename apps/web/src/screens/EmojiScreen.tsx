import { useEffect, useState } from 'react';
import { audio } from '../audio/engine';
import { placementsFromGroups } from '../game/scoring';
import type { EmojiState, TeamId } from '../game/types';
import { formatClock, type ScreenProps } from './common';

interface Card {
  title: string;
  emojis: string;
  hint: string;
}

const CARDS: Card[] = [
  { title: 'Titanic', emojis: '🚢🧊💔🎻🌊', hint: 'Skip, isfjell, kjærlighet' },
  { title: 'Løvenes konge', emojis: '🦁👑🐗🐒🌅', hint: 'Disney, savanne' },
  { title: 'Interstellar', emojis: '👨‍🚀🌽🕳️⏳🌌', hint: 'Romfart, tid, Nolan' },
  { title: 'Hjemme alene', emojis: '🏠👦🎄🧱😱', hint: 'Jul, innbruddstyver' },
  { title: 'Frihetens regn', emojis: '⛓️🔨🖼️🕳️🌧️', hint: 'Fengsel, tunnel bak plakaten' },
  { title: 'Haisommer', emojis: '🦈🏖️🚤🎶😱', hint: 'Jaws, Spielberg' },
  { title: 'Fight Club', emojis: '👊🧼🤫🏢💥', hint: 'Første regel…' },
  { title: 'Forrest Gump', emojis: '🏃‍♂️🍫🪶🏓🦐', hint: 'Livet er som en eske sjokolade' },
];

function initEmoji(): EmojiState {
  return { current: 0, answers: [], revealed: false };
}

export function EmojiScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const teams = state.teams;
  const e = state.emoji;
  const [now, setNow] = useState(Date.now());
  const duration = event.durationSec || 30;

  const setE = (fn: (e: EmojiState) => EmojiState): void => update((s) => ({ ...s, emoji: s.emoji ? fn(s.emoji) : s.emoji }));

  useEffect(() => {
    audio.playMusic('arena');
    if (!e) update((s) => ({ ...s, emoji: initEmoji() }));
  }, [e, update]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = e?.startedAt ? (now - e.startedAt) / 1000 : 0;
  const timeLeft = Math.max(0, duration - elapsed);
  const timeUp = !!e?.startedAt && timeLeft <= 0;

  useEffect(() => {
    if (timeUp && !e?.revealed) audio.sfx('buzz');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  if (!e) return null;

  const done = e.current >= CARDS.length;
  const card = CARDS[e.current];
  const team = teams[e.current % teams.length];
  const answered = e.answers.some((a) => a.card === e.current);

  const answer = (correct: boolean): void => {
    audio.sfx(correct ? 'ding' : 'fail');
    const seconds = Math.min(duration, Math.round(elapsed * 10) / 10);
    setE((st) => ({
      ...st,
      revealed: true,
      answers: [...st.answers.filter((a) => a.card !== st.current), { card: st.current, teamId: team.id, correct, seconds }],
    }));
  };

  const next = (): void => {
    audio.sfx('whoosh');
    setE((st) => ({ ...st, current: st.current + 1, startedAt: undefined, revealed: false }));
  };

  const summary = teams.map((t) => {
    const mine = e.answers.filter((a) => a.teamId === t.id);
    const correct = mine.filter((a) => a.correct).length;
    const time = mine.filter((a) => a.correct).reduce((sum, a) => sum + a.seconds, 0);
    return { team: t, correct, time };
  });

  const finish = (): void => {
    audio.sfx('sting');
    const sorted = [...summary].sort((a, b) => b.correct - a.correct || a.time - b.time);
    const groups: TeamId[][] = [];
    let prev: string | null = null;
    for (const s of sorted) {
      const key = `${s.correct}-${s.correct > 0 ? s.time : 0}`;
      if (prev !== null && key === prev) groups[groups.length - 1].push(s.team.id);
      else groups.push([s.team.id]);
      prev = key;
    }
    update((s) => ({
      ...s,
      pending: {
        placements: placementsFromGroups(groups),
        note: `Riktige svar (tid brukt): ${sorted.map((s) => `${s.team.emoji} ${s.team.name} ${s.correct} (${Math.round(s.time)}s)`).join(' · ')}. Juster om nødvendig.`,
      },
    }));
    go({ name: 'event-rank', index });
  };

  if (done) {
    return (
      <div className="screen emoji">
        <h1 className="play-title">🎬 Alle filmene er gjettet</h1>
        <div className="emoji-summary">
          {summary.map((s) => (
            <div key={s.team.id} className="emoji-summary-row" style={{ ['--team' as string]: s.team.color }}>
              <span>
                {s.team.emoji} {s.team.name}
              </span>
              <strong>{s.correct} riktige</strong>
              <span className="muted">{Math.round(s.time)} s</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-xl" data-primary onClick={finish}>
          Til resultat →
        </button>
      </div>
    );
  }

  return (
    <div className="screen emoji" style={{ ['--team' as string]: team.color }}>
      <div className="event-intro-kicker">
        Film {e.current + 1} av {CARDS.length}
      </div>
      <h1 className="play-title">
        {team.emoji} {team.name} sin tur
      </h1>

      {!e.startedAt ? (
        <>
          <div className="emoji-card emoji-card-hidden">
            <span>🎬</span>
          </div>
          <button
            className="btn btn-primary btn-xl"
            data-primary
            onClick={() => {
              audio.sfx('flip');
              setE((st) => ({ ...st, startedAt: Date.now() }));
            }}
          >
            Vis filmen
          </button>
        </>
      ) : (
        <>
          <div className={`countdown countdown-small ${timeUp ? 'countdown-over' : timeLeft < 10 ? 'countdown-warn' : ''}`}>
            {answered ? '✔' : timeUp ? 'Tiden er ute' : formatClock(timeLeft)}
          </div>
          <div className="emoji-card">{card.emojis}</div>
          {e.revealed && (
            <div className="emoji-answer">
              {card.title} <small className="muted">({card.hint})</small>
            </div>
          )}
          {answered ? (
            <button className="btn btn-primary btn-xl" data-primary onClick={next}>
              {e.current + 1 < CARDS.length ? 'Neste film →' : 'Se oppsummering →'}
            </button>
          ) : (
            <div className="rank-actions">
              <button className="btn btn-ghost" onClick={() => setE((st) => ({ ...st, revealed: !st.revealed }))}>
                {e.revealed ? 'Skjul fasit' : 'Vis fasit (kun for lederen)'}
              </button>
              <button className="btn btn-role btn-role-mafia" onClick={() => answer(false)}>
                ❌ Feil
              </button>
              <button className="btn btn-role btn-role-correct" onClick={() => answer(true)}>
                ✅ Riktig
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
