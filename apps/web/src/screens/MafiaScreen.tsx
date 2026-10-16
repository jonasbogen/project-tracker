import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { Portal } from '../components/Portal';
import { placementsFromGroups } from '../game/scoring';
import type { MafiaPlayer, MafiaRole, MafiaState, Team, TeamId } from '../game/types';
import { formatClock, type ScreenProps } from './common';

/**
 * The mafia music: the sound of the user's own clip, looped from the moment
 * the event opens until the screen is left (mafia and police included). Only
 * the sound. The backing track waits and comes back afterwards.
 */
const MAFIA_MUSIC = '/mafia.m4a';

const ROLE_LABEL: Record<MafiaRole, string> = { mafia: 'Mafia', politi: 'Politi', sivil: 'Sivil' };
const ROLE_EMOJI: Record<MafiaRole, string> = { mafia: '🔫', politi: '👮', sivil: '🙂' };
const NEXT_ROLE: Record<MafiaRole, MafiaRole> = { sivil: 'mafia', mafia: 'politi', politi: 'sivil' };

function initMafia(teams: Team[]): MafiaState {
  const players: MafiaPlayer[] = [];
  for (const t of teams) {
    t.players.forEach((name, i) => players.push({ id: `${t.id}-${i}`, name, teamId: t.id, alive: true }));
  }
  const n = players.length;
  return {
    players,
    mafiaCount: Math.max(1, Math.round(n / 4.5)),
    policeCount: n >= 10 ? 2 : 1,
    round: 0,
    step: 'setup',
  };
}

function winnerOf(m: MafiaState): 'mafia' | 'byen' | undefined {
  const alive = m.players.filter((p) => p.alive);
  const deadMafia = m.players.filter((p) => !p.alive && p.role === 'mafia').length;
  const aliveMafia = Math.max(0, m.mafiaCount - deadMafia);
  const aliveOthers = alive.length - aliveMafia;
  if (aliveMafia === 0) return 'byen';
  if (aliveMafia >= aliveOthers) return 'mafia';
  return undefined;
}

export function MafiaScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const teams = state.teams;
  const m = state.mafia;
  const [now, setNow] = useState(Date.now());
  const [revealAnim, setRevealAnim] = useState<{ name: string; role: MafiaRole; by: 'mafia' | 'vote'; variant: number } | null>(null);
  const revealTimer = useRef<number | null>(null);

  const showReveal = (name: string, role: MafiaRole, by: 'mafia' | 'vote'): void => {
    setRevealAnim({ name, role, by, variant: Math.floor(Math.random() * 3) });
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(() => setRevealAnim(null), 4200);
    window.setTimeout(() => audio.sfx(role === 'mafia' ? 'cheer' : role === 'politi' ? 'boo' : 'fail'), 700);
  };

  const setM = (fn: (m: MafiaState) => MafiaState): void => update((s) => ({ ...s, mafia: s.mafia ? fn(s.mafia) : s.mafia }));

  useEffect(() => {
    if (!m) update((s) => ({ ...s, mafia: initMafia(s.teams) }));
  }, [m, update]);

  // The mafia music runs through the whole event; leaving hands the sound back to the backing track.
  useEffect(() => {
    const el = audio.playTrack(MAFIA_MUSIC, true);
    // No file (or a broken one): the backing track carries on instead of silence.
    el?.addEventListener('error', () => audio.stopTrack(), { once: true });
    return () => audio.stopTrack();
  }, []);

  useEffect(() => {
    if (!m) return;
    if (m.step === 'day-discuss' || m.step === 'day-vote') audio.playMusic('daylight');
    else if (m.step === 'reveal-all' || m.step === 'end') audio.playMusic(m.winner === 'byen' ? 'victory' : 'noir');
    else audio.playMusic('noir');
    if (m.step === 'night-sleep') audio.sfx('howl');
  }, [m?.step, m?.winner]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  if (!m) return null;

  const alive = m.players.filter((p) => p.alive);
  const dead = m.players.filter((p) => !p.alive);
  const teamOf = (id: TeamId): Team | undefined => teams.find((t) => t.id === id);
  const civilians = Math.max(0, m.players.length - m.mafiaCount - m.policeCount);
  const deadMafia = dead.filter((p) => p.role === 'mafia').length;
  const deadPolice = dead.filter((p) => p.role === 'politi').length;

  const afterDeath = (st: MafiaState): MafiaState => {
    const w = winnerOf(st);
    if (w) return { ...st, winner: w, step: 'reveal-all' };
    if (st.step === 'night-victim') return { ...st, step: 'day-discuss', discussStartedAt: Date.now() };
    return { ...st, step: 'night-sleep', round: st.round + 1 };
  };

  const applyDeath = (st: MafiaState, id: string, role: MafiaRole): MafiaState => {
    const by: 'mafia' | 'vote' = st.step === 'night-victim' ? 'mafia' : 'vote';
    const players = st.players.map((p) => (p.id === id ? { ...p, alive: false, role, diedRound: st.round, diedBy: by } : p));
    const name = st.players.find((p) => p.id === id)?.name ?? '';
    return afterDeath({ ...st, players, pendingReveal: undefined, lastDeath: { name, role } });
  };

  const kill = (id: string | null): void => {
    if (!id) {
      audio.sfx('click');
      setM((st) => afterDeath({ ...st, lastDeath: undefined }));
      return;
    }
    audio.sfx(m.step === 'night-victim' ? 'gunshot' : 'gavel');
    const by: 'mafia' | 'vote' = m.step === 'night-victim' ? 'mafia' : 'vote';
    const player = m.players.find((p) => p.id === id);
    const mafiaMarked = alive.filter((p) => p.role === 'mafia').length >= Math.max(0, m.mafiaCount - deadMafia);
    const known = player?.role ?? (mafiaMarked ? 'sivil' : undefined);
    if (known) {
      showReveal(player?.name ?? '', known, by);
      setM((st) => applyDeath(st, id, known));
    } else {
      setM((st) => ({ ...st, pendingReveal: id }));
    }
  };

  const reveal = (role: MafiaRole): void => {
    const p = m.players.find((x) => x.id === m.pendingReveal);
    showReveal(p?.name ?? '', role, m.step === 'night-victim' ? 'mafia' : 'vote');
    setM((st) => applyDeath(st, st.pendingReveal!, role));
  };

  const toggleRole = (id: string, role: MafiaRole): void => {
    audio.sfx('tick');
    setM((st) => ({ ...st, players: st.players.map((p) => (p.id === id ? { ...p, role: p.role === role ? undefined : role } : p)) }));
  };

  const BACK: Partial<Record<MafiaState['step'], MafiaState['step']>> = {
    'night-mafia': 'night-sleep',
    'night-police': 'night-mafia',
    'night-victim': m.policeCount - deadPolice > 0 ? 'night-police' : 'night-mafia',
    'day-discuss': 'night-victim',
    'day-vote': 'day-discuss',
  };
  const backButton = BACK[m.step] && (
    <button
      className="btn btn-ghost btn-sm mafia-back"
      onClick={() => {
        audio.sfx('back');
        setM((st) => ({ ...st, step: BACK[st.step]! }));
      }}
    >
      ← Tilbake
    </button>
  );

  const deathBanner = m.lastDeath && (
    <div className="death-banner">
      💀 {m.lastDeath.name} ({ROLE_EMOJI[m.lastDeath.role]} {ROLE_LABEL[m.lastDeath.role]}) er ute – <strong>5 slurker!</strong> 🍻
    </div>
  );

  const finish = (): void => {
    audio.sfx('sting');
    const winner = m.winner ?? 'byen';
    const scores: Record<TeamId, { sum: number; n: number; alive: number }> = {};
    for (const t of teams) scores[t.id] = { sum: 0, n: 0, alive: 0 };
    for (const p of m.players) {
      const role = p.role ?? 'sivil';
      const side = role === 'mafia' ? 'mafia' : 'byen';
      let pts = 0;
      if (side === winner) pts += 3;
      if (p.alive) pts += 1;
      scores[p.teamId].sum += pts;
      scores[p.teamId].n += 1;
      if (p.alive) scores[p.teamId].alive += 1;
    }
    const avg = (id: TeamId): number => (scores[id].n ? scores[id].sum / scores[id].n : 0);
    const sorted = [...teams].sort((a, b) => avg(b.id) - avg(a.id) || scores[b.id].alive - scores[a.id].alive);
    const groups: TeamId[][] = [];
    let prev: number | null = null;
    for (const t of sorted) {
      const key = avg(t.id) * 100 + scores[t.id].alive;
      if (prev !== null && key === prev) groups[groups.length - 1].push(t.id);
      else groups.push([t.id]);
      prev = key;
    }
    const summary = sorted.map((t) => `${t.name} ${avg(t.id).toFixed(1)}`).join(' · ');
    update((s) => ({
      ...s,
      mafia: s.mafia ? { ...s.mafia, step: 'end' } : s.mafia,
      pending: {
        placements: placementsFromGroups(groups),
        note: `${winner === 'mafia' ? 'Mafiaen' : 'Byen'} vant. Snitt per spiller (3 for vinnende side, 1 for å overleve): ${summary}. Juster om nødvendig.`,
      },
    }));
    go({ name: 'event-rank', index });
  };

  const playerList = (onPick: (id: string) => void, pool: MafiaPlayer[] = alive, markRole?: MafiaRole) => (
    <div className="mafia-teams">
      {teams.map((t) => (
        <div key={t.id} className="mafia-team" style={{ ['--team' as string]: t.color }}>
          <div className="mafia-team-name">
            <TeamMark team={t} /> {t.name}
          </div>
          <div className="mafia-players">
            {pool
              .filter((p) => p.teamId === t.id)
              .map((p) => {
                const marked = !!markRole && p.role === markRole;
                return (
                  <button key={p.id} className={`mafia-player ${marked ? `role-${markRole}` : ''}`} onClick={() => onPick(p.id)}>
                    {marked ? `${ROLE_EMOJI[markRole]} ` : ''}
                    {p.name}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
  const markedCount = (role: MafiaRole): number => alive.filter((p) => p.role === role).length;

  const graveyard = dead.length > 0 && (
    <div className="graveyard">
      {dead.map((p) => (
        <span key={p.id} className="grave" style={{ ['--team' as string]: teamOf(p.teamId)?.color }}>
          🪦 {p.name} <small>{p.role ? ROLE_EMOJI[p.role] : ''}</small>
        </span>
      ))}
    </div>
  );

  const status = (
    <div className="mafia-status">
      <span>Runde {Math.max(1, m.round)}</span>
      <span>
        🔫 Mafia igjen: {Math.max(0, m.mafiaCount - deadMafia)}/{m.mafiaCount}
      </span>
      <span>
        👮 Politi igjen: {Math.max(0, m.policeCount - deadPolice)}/{m.policeCount}
      </span>
      <span>I live: {alive.length}</span>
    </div>
  );

  const revealOverlay = revealAnim && (
    <Portal>
      <div className={`reveal-overlay reveal-${revealAnim.role} reveal-v${revealAnim.variant}`} onClick={() => setRevealAnim(null)}>
        <div className="reveal-flash" />
        <div className="reveal-card-big">
          <div className="reveal-by">{revealAnim.by === 'mafia' ? '🌙 Drept i natt' : '🗳️ Stemt ut av byen'}</div>
          <div className="reveal-name-big">{revealAnim.name}</div>
          <div className="reveal-role-emoji">{ROLE_EMOJI[revealAnim.role]}</div>
          <div className="reveal-role-text">{revealAnim.role === 'mafia' ? 'VAR MAFIA!' : revealAnim.role === 'politi' ? 'VAR POLITI' : 'VAR SIVIL'}</div>
          <div className="reveal-drink">🍻 5 slurker</div>
        </div>
      </div>
    </Portal>
  );

  if (m.pendingReveal) {
    const p = m.players.find((x) => x.id === m.pendingReveal);
    return (
      <div className="screen mafia mafia-night">
        <h1 className="play-title">💀 {p?.name} er ute av spillet</h1>
        <p className="play-sub big">5 slurker! 🍻</p>
        <p className="play-sub">Vis kortet! Hvilken rolle hadde {p?.name}?</p>
        <div className="role-buttons">
          {(['mafia', 'politi', 'sivil'] as MafiaRole[]).map((r) => (
            <button key={r} className={`btn btn-role btn-role-${r}`} onClick={() => reveal(r)}>
              {ROLE_EMOJI[r]} {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const body = (() => {
  switch (m.step) {
    case 'setup':
      return (
        <div className="screen mafia mafia-setup">
          <h1 className="play-title">🕵️ Mafia og politi – del ut kort</h1>
          {m.players.length === 0 ? (
            <p className="play-sub warn">Ingen spillere er lagt inn. Gå til Oppsett og skriv inn spillerne på hvert lag.</p>
          ) : (
            <p className="play-sub">
              {m.players.length} spillere. Del ut <strong>{m.mafiaCount} ess (mafia)</strong>, <strong>{m.policeCount} konger (politi)</strong> og{' '}
              <strong>{civilians} andre kort (sivile)</strong>. Alle ser sitt kort i hemmelighet.
            </p>
          )}
          <div className="role-counts">
            <label>
              🔫 Mafia
              <button className="btn btn-ghost btn-sm" onClick={() => setM((st) => ({ ...st, mafiaCount: Math.max(1, st.mafiaCount - 1) }))}>−</button>
              <strong>{m.mafiaCount}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setM((st) => ({ ...st, mafiaCount: st.mafiaCount + 1 }))}>+</button>
            </label>
            <label>
              👮 Politi
              <button className="btn btn-ghost btn-sm" onClick={() => setM((st) => ({ ...st, policeCount: Math.max(0, st.policeCount - 1) }))}>−</button>
              <strong>{m.policeCount}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setM((st) => ({ ...st, policeCount: st.policeCount + 1 }))}>+</button>
            </label>
          </div>
          {playerList(() => undefined)}
          <div className="rank-actions">
            <button className="btn btn-ghost" onClick={() => update((s) => ({ ...s, mafia: initMafia(s.teams) }))}>
              Hent spillere på nytt
            </button>
            <button
              className="btn btn-primary btn-xl"
              data-primary
              disabled={m.players.length < 4}
              onClick={() => {
                audio.sfx('whoosh');
                setM((st) => ({ ...st, step: 'night-sleep', round: 1 }));
              }}
            >
              Kortene er delt ut – natten faller →
            </button>
          </div>
        </div>
      );

    case 'night-sleep':
      return (
        <div className="screen mafia mafia-night">
          <div className="moon" />
          <h1 className="play-title">🌙 Natt {m.round}</h1>
          {deathBanner}
          <p className="play-sub big">Byen sover. Alle lukker øynene.</p>
          {status}
          <button className="btn btn-primary btn-xl" data-primary onClick={() => { audio.sfx('click'); setM((st) => ({ ...st, step: 'night-mafia' })); }}>
            Mafiaen våkner →
          </button>
        </div>
      );

    case 'night-mafia':
      return (
        <div className="screen mafia mafia-night mafia-mafia">
          {backButton}
          <h1 className="play-title">🔫 Mafiaen våkner</h1>
          <p className="play-sub big">Mafiaen åpner øynene, ser på hverandre og peker i stillhet på den de vil fjerne.</p>
          <p className="play-sub">
            {m.round === 1 ? 'Trykk på de som er mafia for å markere dem.' : 'Markerte mafia:'} ({markedCount('mafia')} av {Math.max(0, m.mafiaCount - deadMafia)})
          </p>
          {playerList((id) => toggleRole(id, 'mafia'), alive, 'mafia')}
          {status}
          <button className="btn btn-primary btn-xl" data-primary onClick={() => { audio.sfx('click'); setM((st) => ({ ...st, step: m.policeCount - deadPolice > 0 ? 'night-police' : 'night-victim' })); }}>
            Mafiaen sover →
          </button>
        </div>
      );

    case 'night-police':
      return (
        <div className="screen mafia mafia-night mafia-police">
          {backButton}
          <h1 className="play-title">👮 Politiet våkner</h1>
          <p className="play-sub big">Politiet peker på én person. Spill-lederen svarer stille med tommel opp (mafia) eller ned.</p>
          <p className="play-sub">
            {m.round === 1 ? 'Trykk på de som er politi for å markere dem.' : 'Markert politi:'} ({markedCount('politi')} av {Math.max(0, m.policeCount - deadPolice)})
          </p>
          {playerList((id) => toggleRole(id, 'politi'), alive, 'politi')}
          {status}
          <button className="btn btn-primary btn-xl" data-primary onClick={() => { audio.sfx('click'); setM((st) => ({ ...st, step: 'night-victim' })); }}>
            Politiet sover →
          </button>
        </div>
      );

    case 'night-victim':
      return (
        <div className="screen mafia mafia-dawn">
          {backButton}
          <h1 className="play-title">🌅 Byen våkner</h1>
          <p className="play-sub">Hvem ble tatt av mafiaen i natt? Trykk på navnet.</p>
          {playerList(kill)}
          <button className="btn btn-ghost" onClick={() => kill(null)}>
            Ingen døde i natt
          </button>
          {graveyard}
        </div>
      );

    case 'day-discuss': {
      const left = state.settings.discussSec - (now - (m.discussStartedAt ?? now)) / 1000;
      const over = left <= 0;
      return (
        <div className="screen mafia mafia-day">
          {backButton}
          <h1 className="play-title">☀️ Dag {m.round} – byen diskuterer</h1>
          {deathBanner}
          <div className={`countdown ${over ? 'countdown-over' : left < 30 ? 'countdown-warn' : ''}`}>{over ? 'Tiden er ute' : formatClock(left)}</div>
          <p className="play-sub">Hvem er mafia? Diskuter, anklag og forsvar dere.</p>
          {status}
          <div className="rank-actions">
            <button className="btn btn-ghost" onClick={() => setM((st) => ({ ...st, discussStartedAt: (st.discussStartedAt ?? Date.now()) + 60_000 }))}>
              +1 min
            </button>
            <button className="btn btn-primary btn-xl" data-primary onClick={() => { audio.sfx('gavel'); setM((st) => ({ ...st, step: 'day-vote' })); }}>
              Til avstemning →
            </button>
          </div>
          {graveyard}
        </div>
      );
    }

    case 'day-vote':
      return (
        <div className="screen mafia mafia-day">
          {backButton}
          <h1 className="play-title">🗳️ Avstemning</h1>
          <p className="play-sub">Hvem stemmer byen ut? Trykk på navnet. Flertallet bestemmer.</p>
          {playerList(kill)}
          <button className="btn btn-ghost" onClick={() => kill(null)}>
            Ingen ble stemt ut
          </button>
          {graveyard}
        </div>
      );

    case 'reveal-all':
    case 'end': {
      const remainingMafia = Math.max(0, m.mafiaCount - deadMafia - alive.filter((p) => p.role === 'mafia').length);
      const remainingPolice = Math.max(0, m.policeCount - deadPolice - alive.filter((p) => p.role === 'politi').length);
      return (
        <div className={`screen mafia ${m.winner === 'byen' ? 'mafia-day' : 'mafia-night'}`}>
          <h1 className="play-title">{m.winner === 'byen' ? '🎉 Byen vant!' : '🔫 Mafiaen vant!'}</h1>
          {deathBanner}
          <p className="play-sub">
            Alle som lever viser kortet sitt. Sjekk at rollene stemmer – trykk på et navn for å endre
            {remainingMafia + remainingPolice > 0 ? ` (${remainingMafia} mafia og ${remainingPolice} politi gjenstår å avsløre)` : ''}.
          </p>
          <div className="mafia-teams">
            {teams.map((t) => (
              <div key={t.id} className="mafia-team" style={{ ['--team' as string]: t.color }}>
                <div className="mafia-team-name">
                  <TeamMark team={t} /> {t.name}
                </div>
                <div className="mafia-players">
                  {alive
                    .filter((p) => p.teamId === t.id)
                    .map((p) => {
                      const role = p.role ?? 'sivil';
                      return (
                        <button
                          key={p.id}
                          className={`mafia-player role-${role}`}
                          onClick={() => {
                            audio.sfx('tick');
                            setM((st) => ({ ...st, players: st.players.map((x) => (x.id === p.id ? { ...x, role: NEXT_ROLE[role] } : x)) }));
                          }}
                        >
                          {ROLE_EMOJI[role]} {p.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          {graveyard}
          <button className="btn btn-primary btn-xl" data-primary onClick={finish}>
            Beregn poeng →
          </button>
        </div>
      );
    }
  }
  })();

  return (
    <>
      {body}
      {revealOverlay}
    </>
  );
}
