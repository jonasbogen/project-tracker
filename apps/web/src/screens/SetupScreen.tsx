import { useEffect } from 'react';
import { audio } from '../audio/engine';
import { newEvent, TEAM_PALETTE } from '../game/store';
import type { GameEvent } from '../game/types';
import { KIND_EMOJI, playedEvents, resumePhase, type ScreenProps } from './common';
import { iconSrc, TEAM_ICONS, TeamMark } from '../components/TeamMark';

/** The TV runs full screen from the moment a game starts. Must be called from a click. */
function enterFullscreen(): void {
  if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => undefined);
}

export function SetupScreen({ state, update, go, onReset }: ScreenProps & { onReset: () => void }) {
  useEffect(() => {
    audio.stopMusic();
  }, []);

  const done = playedEvents(state);
  const played = state.events.filter((e) => done.has(e.id)).length;
  const hasProgress = played > 0;

  const setTeam = (id: string, patch: Partial<(typeof state.teams)[number]>): void =>
    update((s) => ({ ...s, teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  const setEvent = (id: string, patch: Partial<GameEvent>): void =>
    update((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const moveEvent = (index: number, dir: -1 | 1): void =>
    update((s) => {
      const events = [...s.events];
      const j = index + dir;
      if (j < 0 || j >= events.length) return s;
      [events[index], events[j]] = [events[j], events[index]];
      return { ...s, events };
    });

  const removeEvent = (id: string): void =>
    update((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));

  const addEvent = (kind: GameEvent['kind']): void =>
    update((s) => ({ ...s, events: [...s.events, newEvent(kind)] }));

  const start = (): void => {
    audio.sfx('whoosh');
    enterFullscreen();
    update((s) => ({ ...s, singleEvent: undefined }));
    go(hasProgress ? resumePhase(state) : { name: 'intro' });
  };

  /** Play one event on its own; its points screen comes back here. */
  const startSingle = (index: number): void => {
    audio.sfx('whoosh');
    enterFullscreen();
    update((s) => ({ ...s, singleEvent: s.events[index].id }));
    go({ name: 'event-intro', index });
  };

  return (
    <div className="screen setup">
      <section className="setup-hero">
        <div className="setup-hero-bg" aria-hidden="true" />
        <div className="setup-hero-fade" aria-hidden="true" />
        <p className="setup-hero-lead">
          Den virkelige utfordringen er ikke de enkelte øvelsene, men å få laget til å fungere sammen. Fyll inn lagene, juster rekkefølgen på
          øvelsene og trykk start. Alt lagres automatisk.
        </p>
        <div className="setup-hero-actions">
          <button className="btn btn-primary btn-xl" data-primary onClick={start} disabled={state.events.length === 0}>
            {hasProgress ? 'Fortsett spillet →' : 'Start spillet →'}
          </button>
          <span className="setup-hero-meta">
            {state.teams.length} lag · {state.events.length} øvelser{hasProgress ? ` · ${played} spilt` : ''}
          </span>
        </div>
      </section>

      <section className="setup-section setup-band setup-band-lag">
        <h2>Lag</h2>
        <div className="team-grid">
          {state.teams.map((team, i) => (
            <div key={team.id} className="team-card" style={{ ['--team' as string]: team.color }}>
              <div className="team-card-top">
                <span className="team-card-mark">
                  <TeamMark team={team} />
                </span>
                <input
                  className="team-name-input"
                  value={team.name}
                  onChange={(e) => setTeam(team.id, { name: e.target.value })}
                  placeholder={`Lag ${i + 1}`}
                  aria-label="Lagnavn"
                />
                <input
                  type="color"
                  value={team.color}
                  onChange={(e) => setTeam(team.id, { color: e.target.value })}
                  aria-label="Lagfarge"
                  list={`palette-${team.id}`}
                />
                <datalist id={`palette-${team.id}`}>
                  {TEAM_PALETTE.map((p) => (
                    <option key={p.color} value={p.color} />
                  ))}
                </datalist>
              </div>
              <div className="icon-pick" role="radiogroup" aria-label="Ikon">
                {TEAM_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    role="radio"
                    aria-checked={team.icon === ic}
                    className={`icon-pick-btn ${team.icon === ic ? 'icon-pick-on' : ''}`}
                    onClick={() => setTeam(team.id, { icon: ic })}
                  >
                    <img src={iconSrc(ic)} alt="" draggable={false} />
                  </button>
                ))}
              </div>
              <textarea
                className="players-input"
                rows={4}
                placeholder="Spillere, én per linje"
                value={team.players.join('\n')}
                onChange={(e) =>
                  setTeam(team.id, {
                    players: e.target.value.split('\n').map((p) => p.trim()).filter((p, idx, arr) => p || idx === arr.length - 1),
                  })
                }
                onBlur={(e) => setTeam(team.id, { players: e.target.value.split('\n').map((p) => p.trim()).filter(Boolean) })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="setup-section setup-band setup-band-ovelser">
        <h2>Øvelser (i rekkefølge)</h2>
        <div className="event-list">
          {state.events.map((ev, i) => (
            <div key={ev.id} className={`event-card ${done.has(ev.id) ? 'event-card-done' : ''}`}>
              <div className="event-card-head">
                <span className="event-index">{i + 1}</span>
                <span className="event-kind">{KIND_EMOJI[ev.kind]}</span>
                <input
                  className="event-title-input"
                  value={ev.title}
                  onChange={(e) => setEvent(ev.id, { title: e.target.value })}
                  aria-label="Navn på øvelse"
                />
                {done.has(ev.id) && <span className="pill pill-done">Spilt</span>}
                <div className="event-actions">
                  <button className="btn btn-primary btn-sm event-play" onClick={() => startSingle(i)} title="Start bare denne øvelsen">
                    ▶ Spill denne
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => moveEvent(i, -1)} disabled={i === 0} title="Flytt opp">
                    ↑
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => moveEvent(i, 1)} disabled={i === state.events.length - 1} title="Flytt ned">
                    ↓
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeEvent(ev.id)} disabled={done.has(ev.id)} title="Fjern">
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                className="event-rules-input"
                rows={2}
                value={ev.rules}
                onChange={(e) => setEvent(ev.id, { rules: e.target.value })}
                aria-label="Regler"
              />
              <div className="event-points">
                {ev.kind === 'six' ? (
                  <>
                    <label>
                      Taperen får
                      <input
                        type="number"
                        value={-Math.abs(ev.penalty)}
                        onChange={(e) => setEvent(ev.id, { penalty: Math.abs(Number(e.target.value)) })}
                      />
                      poeng
                    </label>
                    <label>
                      Tid
                      <input
                        type="number"
                        value={Math.round(ev.durationSec / 60)}
                        min={1}
                        onChange={(e) => setEvent(ev.id, { durationSec: Math.max(1, Number(e.target.value)) * 60 })}
                      />
                      min
                    </label>
                  </>
                ) : ev.kind === 'wheel' ? (
                  <label>
                    Treff gir
                    <input
                      type="number"
                      value={ev.points[0] ?? 0}
                      onChange={(e) => setEvent(ev.id, { points: [Number(e.target.value), 0, 0, 0] })}
                    />
                    poeng
                  </label>
                ) : (
                  [0, 1, 2, 3].map((p) => (
                    <label key={p}>
                      {p + 1}.
                      <input
                        type="number"
                        value={ev.points[p] ?? 0}
                        onChange={(e) => {
                          const points = [...ev.points];
                          points[p] = Number(e.target.value);
                          setEvent(ev.id, { points });
                        }}
                      />
                    </label>
                  ))
                )}
                {ev.kind === 'mafia' && (
                  <label>
                    Diskusjon
                    <input
                      type="number"
                      min={1}
                      value={Math.round(state.settings.discussSec / 60)}
                      onChange={(e) =>
                        update((s) => ({ ...s, settings: { ...s.settings, discussSec: Math.max(1, Number(e.target.value)) * 60 } }))
                      }
                    />
                    min
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="add-row">
          <span className="muted">Legg til:</span>
          <button className="btn btn-ghost" onClick={() => addEvent('custom')}>🎯 Egen øvelse</button>
          <button className="btn btn-ghost" onClick={() => addEvent('horse')}>🐎 Hesteveddeløp</button>
          <button className="btn btn-ghost" onClick={() => addEvent('six')}>⏱️ 6 minutter</button>
          <button className="btn btn-ghost" onClick={() => addEvent('mafia')}>🕵️ Mafia og politi</button>
          <button className="btn btn-ghost" onClick={() => addEvent('emoji')}>🎬 Emoji Movie</button>
          <button className="btn btn-ghost" onClick={() => addEvent('wheel')}>🎡 Wheel of Fortune</button>
          <button className="btn btn-ghost" onClick={() => addEvent('deal')}>💼 Deal or Drink</button>
        </div>
      </section>

      <footer className="setup-footer">
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Nullstille alt? Lag, øvelser og poeng slettes.')) onReset();
          }}
        >
          Nullstill alt
        </button>
        <button className="btn btn-primary btn-xl" onClick={start} disabled={state.events.length === 0}>
          {hasProgress ? 'Fortsett spillet →' : 'Start spillet →'}
        </button>
      </footer>
    </div>
  );
}
