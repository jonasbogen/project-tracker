import { useEffect, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { placementsFromGroups } from '../game/scoring';
import { ICE_SONG } from '../game/songs';
import type { EmojiState, TeamId } from '../game/types';
import type { ScreenProps } from './common';

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

const DURATION = 10;

function initEmoji(): EmojiState {
  return { current: 0, answers: [], revealed: false };
}

/**
 * Emoji Movie, with the Ice round between the two rounds of films: once every
 * team has had one film, the Ice song plays and the next team that has not
 * had its Ice chance tonight may chug one. If it does, it wins any tie on
 * correct answers when the films are done.
 */
export function EmojiScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const teams = state.teams;
  const e = state.emoji;
  const [now, setNow] = useState(Date.now());

  const setE = (fn: (e: EmojiState) => EmojiState): void => update((s) => ({ ...s, emoji: s.emoji ? fn(s.emoji) : s.emoji }));

  useEffect(() => {
    audio.playMusic('arena');
    if (!e) update((s) => ({ ...s, emoji: initEmoji() }));
  }, [e, update]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // The Ice round opens when the first round of films is over and nobody has started the next one.
  const iceOpen = !!e && !e.iceDone && !!e.ice;
  useEffect(() => {
    if (!e || e.iceDone || e.ice || e.startedAt || e.current !== teams.length || teams.length === 0) return;
    const offered = new Set(state.iceOffered ?? []);
    const team = teams.find((t) => !offered.has(t.id));
    if (!team) {
      setE((st) => ({ ...st, iceDone: true }));
      return;
    }
    update((s) => ({
      ...s,
      iceOffered: [...(s.iceOffered ?? []), team.id],
      emoji: s.emoji ? { ...s.emoji, ice: { team: team.id } } : s.emoji,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.current, e?.iceDone, !!e?.ice, e?.startedAt, teams.length]);

  // The Ice song loops while the team decides; the backing track comes back afterwards.
  useEffect(() => {
    if (!iceOpen) return;
    audio.playTrack(ICE_SONG, true);
    return () => audio.stopTrack();
  }, [iceOpen]);

  const elapsed = e?.startedAt ? (now - e.startedAt) / 1000 : 0;
  const timeLeft = Math.max(0, DURATION - elapsed);
  const timeUp = !!e?.startedAt && timeLeft <= 0;
  const secondsLeft = Math.ceil(timeLeft);

  useEffect(() => {
    if (timeUp && !e?.revealed) audio.sfx('buzz');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  useEffect(() => {
    if (e?.startedAt && !timeUp && secondsLeft <= 3 && secondsLeft > 0) audio.sfx('tick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (!e) return null;

  const done = e.current >= CARDS.length;
  const card = CARDS[e.current];
  const team = teams[e.current % teams.length];
  const answered = e.answers.some((a) => a.card === e.current);
  const iceTeam = e.ice ? teams.find((t) => t.id === e.ice!.team) : undefined;
  const iceWinner = e.ice?.accepted ? e.ice.team : undefined;

  const answer = (correct: boolean): void => {
    audio.sfx(correct ? 'ding' : 'fail');
    setE((st) => ({
      ...st,
      revealed: true,
      answers: [...st.answers.filter((a) => a.card !== st.current), { card: st.current, teamId: team.id, correct }],
    }));
  };

  const next = (): void => {
    audio.sfx('whoosh');
    setE((st) => ({ ...st, current: st.current + 1, startedAt: undefined, revealed: false }));
  };

  const iceChoose = (accepted: boolean): void => {
    audio.sfx(accepted ? 'cheer' : 'click');
    setE((st) => (st.ice ? { ...st, ice: { ...st.ice, accepted } } : st));
  };

  const iceGo = (): void => {
    audio.sfx('whoosh');
    update((s) => {
      const st = s.emoji;
      if (!st?.ice || st.ice.accepted === undefined) return s;
      const iceTeams = st.ice.accepted && !(s.iceTeams ?? []).includes(st.ice.team) ? [...(s.iceTeams ?? []), st.ice.team] : s.iceTeams;
      return { ...s, iceTeams, emoji: { ...st, iceDone: true } };
    });
  };

  const summary = teams.map((t) => {
    const mine = e.answers.filter((a) => a.teamId === t.id);
    return { team: t, correct: mine.filter((a) => a.correct).length, total: mine.length };
  });

  const finish = (): void => {
    audio.sfx('sting');
    const sorted = [...summary].sort((a, b) => b.correct - a.correct);
    const groups: TeamId[][] = [];
    let prev: number | null = null;
    for (const s of sorted) {
      if (prev !== null && s.correct === prev) groups[groups.length - 1].push(s.team.id);
      else groups.push([s.team.id]);
      prev = s.correct;
    }
    // The Ice tie-break: the team that chugged goes ahead of the teams it is level with.
    let iceNote = '';
    if (iceWinner) {
      const gi = groups.findIndex((g) => g.includes(iceWinner));
      if (gi >= 0 && groups[gi].length > 1) {
        const rest = groups[gi].filter((id) => id !== iceWinner);
        groups.splice(gi, 1, [iceWinner], rest);
        iceNote = ` ${teams.find((t) => t.id === iceWinner)?.name ?? '?'} vinner tiebreaken på Smirnoff Ice.`;
      }
    }
    update((s) => ({
      ...s,
      pending: {
        placements: placementsFromGroups(groups),
        note: `Riktige svar: ${sorted.map((s) => `${s.team.name} ${s.correct}`).join(' · ')}.${iceNote || ' Likt antall deler plassen.'} Juster om nødvendig.`,
      },
    }));
    go({ name: 'event-rank', index });
  };

  if (iceOpen && iceTeam) {
    return (
      <div className="screen emoji">
        <div className="six-ice" style={{ ['--team' as string]: iceTeam.color }}>
          <div className="six-ice-kicker">Alle lag har hatt én film</div>
          <h2 className="six-ice-title">🧊 ICE-RUNDE</h2>
          <p className="six-ice-text">
            <strong>{iceTeam.name}</strong> kan chugge en Smirnoff Ice nå. Står det likt på riktige svar når alle filmene er gjettet, vinner de
            tiebreaken.
          </p>
          <div className="six-ice-choices">
            <button type="button" className={`btn btn-xl six-ice-yes ${e.ice?.accepted === true ? 'six-ice-on' : ''}`} onClick={() => iceChoose(true)}>
              🍾 Vi tar en Ice – vinner ved likt
            </button>
            <button type="button" className={`btn btn-ghost btn-xl ${e.ice?.accepted === false ? 'six-ice-on' : ''}`} onClick={() => iceChoose(false)}>
              Nei takk
            </button>
          </div>
          <button type="button" className="btn btn-primary btn-xl" data-primary disabled={e.ice?.accepted === undefined} onClick={iceGo}>
            Videre til runde 2 →
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="screen emoji">
        <h1 className="play-title">🎬 Alle filmene er gjettet</h1>
        <div className="emoji-summary">
          {summary.map((s) => (
            <div key={s.team.id} className="emoji-summary-row" style={{ ['--team' as string]: s.team.color }}>
              <span>
                <TeamMark team={s.team} /> {s.team.name}
                {iceWinner === s.team.id && <span className="emoji-ice-badge">🧊 vinner ved likt</span>}
              </span>
              <strong>
                {s.correct} av {s.total} riktige
              </strong>
              <span className="emoji-dots">
                {e.answers
                  .filter((a) => a.teamId === s.team.id)
                  .map((a) => (
                    <span key={a.card}>{a.correct ? '✅' : '❌'}</span>
                  ))}
              </span>
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
        <TeamMark team={team} /> {team.name} sin tur
        {iceWinner === team.id && <span className="emoji-ice-badge">🧊</span>}
      </h1>

      {!e.startedAt ? (
        <>
          <div className="emoji-card emoji-card-hidden">
            <span>🎬</span>
          </div>
          <p className="play-sub">10 sekunder fra filmen vises. Bare riktig eller feil teller.</p>
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
          <div className={`countdown countdown-small ${timeUp ? 'countdown-over' : secondsLeft <= 3 ? 'countdown-warn' : ''}`}>
            {answered ? (e.answers.find((a) => a.card === e.current)?.correct ? '✅' : '❌') : timeUp ? 'Tiden er ute' : secondsLeft}
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
