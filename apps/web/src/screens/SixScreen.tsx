import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { GAP_SEC, MOST_BONUS, SIPS, SONGS, SONG_SEC, shuffledOrder, type Song } from '../game/songs';
import type { SixState, Team, TeamId } from '../game/types';
import type { ScreenProps } from './common';

/**
 * 6 minutter: a hidden six-minute clock with a song quiz on top. Twenty
 * seconds of each song play (audio only, the recordings are never shown).
 * The teams take turns, one song each, team 1 first; the team whose turn it
 * is shouts out the title and the artist, and the host presses the Tittel
 * box or the Artist box when they get it. An open box shows its answer (the
 * title with a little emoji scene, the artist with a portrait) and "del ut
 * 5 slurker"; a small undo in its corner closes it again. When both boxes
 * are open, or the twenty seconds run out, there is a two-second silent
 * pause and the next song and team come up. A table bottom-left keeps count
 * of titles and artists per team; the team with the most gets 2 extra
 * points when the alarm goes. Nothing on screen says how many songs have
 * played, so nobody can estimate the clock.
 */
export function SixScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const teams = state.teams;
  const six: SixState = state.six ?? { finished: false };
  const [now, setNow] = useState(Date.now());
  const running = !!six.startedAt && !six.finished;
  const order = six.order ?? [];
  const pos = six.pos ?? 0;
  const songIndex = order[pos];
  const song = songIndex !== undefined ? SONGS[songIndex] : undefined;
  const songStartedAt = six.songStartedAt ?? six.startedAt ?? 0;
  const inGap = !!six.gapUntil;
  const played = six.played ?? [];
  const last = played.length ? played[played.length - 1] : undefined;
  const lastSong = last ? SONGS[last.song] : undefined;
  // Team 1 opens, then one song per team round and round.
  const turnTeam: Team | undefined = teams.length ? teams[played.length % teams.length] : undefined;

  const stats = tally(teams, six);

  // Nothing synthesized here: the quiz clips take over from the backing track while they play.
  useEffect(() => {
    if (!running) audio.stopMusic(0.3);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [running]);

  // The hidden clock.
  useEffect(() => {
    if (!running) return;
    const elapsed = (now - six.startedAt!) / 1000;
    if (elapsed >= event.durationSec) {
      update((s) => ({ ...s, six: { ...(s.six ?? { finished: false }), finished: true } }));
    }
  }, [now, running, six.startedAt, event.durationSec, update]);

  /** Opens a box. When both are open the pause before the next song begins. */
  const reveal = (which: 'title' | 'artist'): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || cur.gapUntil) return s;
      const gotTitle = cur.gotTitle || which === 'title';
      const gotArtist = cur.gotArtist || which === 'artist';
      if (gotTitle === !!cur.gotTitle && gotArtist === !!cur.gotArtist) return s;
      const both = gotTitle && gotArtist;
      return { ...s, six: { ...cur, gotTitle, gotArtist, gapUntil: both ? Date.now() + GAP_SEC * 1000 : undefined } };
    });
  };

  /** Closes a box again after a wrong press. Cancels the pause so the song plays on if there is time left. */
  const undo = (which: 'title' | 'artist'): void => {
    audio.sfx('back');
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished) return s;
      return { ...s, six: { ...cur, gotTitle: which === 'title' ? false : cur.gotTitle, gotArtist: which === 'artist' ? false : cur.gotArtist, gapUntil: undefined } };
    });
  };

  /** The twenty seconds are up (or the host skipped): open what is left and start the pause. */
  const timeUp = (expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || cur.gapUntil || (cur.pos ?? 0) !== expectedPos) return s;
      return { ...s, six: { ...cur, gapUntil: Date.now() + GAP_SEC * 1000 } };
    });
  };

  /** The pause is over: book the song for the team and start the next one. */
  const advance = (expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || !cur.gapUntil || (cur.pos ?? 0) !== expectedPos) return s;
      const curOrder = cur.order ?? shuffledOrder();
      const curSong = curOrder[cur.pos ?? 0];
      const prev = cur.played ?? [];
      const team = s.teams.length ? s.teams[prev.length % s.teams.length].id : '';
      const nextPlayed = [...prev, ...(curSong !== undefined ? [{ song: curSong, team, title: !!cur.gotTitle, artist: !!cur.gotArtist }] : [])];
      let nextOrder = curOrder;
      let nextPos = (cur.pos ?? 0) + 1;
      if (nextPos >= curOrder.length) {
        // Every song has been played once: new shuffle, the opener up front again.
        nextOrder = shuffledOrder();
        nextPos = 0;
      }
      return {
        ...s,
        six: { ...cur, order: nextOrder, pos: nextPos, songStartedAt: Date.now(), gotTitle: false, gotArtist: false, gapUntil: undefined, played: nextPlayed },
      };
    });
  };

  const timeUpRef = useRef(timeUp);
  timeUpRef.current = timeUp;

  // Song timer and pause timer, driven by the clock so a refresh picks them up again.
  useEffect(() => {
    if (!running) return;
    if (inGap) {
      if (now >= six.gapUntil!) advance(pos);
    } else if (now - songStartedAt >= SONG_SEC * 1000) {
      timeUp(pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, running, inGap, songStartedAt, pos]);

  // The song that is playing: 20 seconds of audio, re-synced to songStartedAt after a refresh.
  // In the pause the clip is stopped and the room is silent; the backing track stays held.
  useEffect(() => {
    if (!running || !song) return;
    if (inGap) {
      audio.stopTrack(false);
      return;
    }
    const offset = Math.max(0, (Date.now() - songStartedAt) / 1000);
    if (offset >= SONG_SEC) return; // the timer effect opens the pause
    audio.playTrack(song.file, false, { offset, onEnded: () => timeUpRef.current(pos) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, inGap, songStartedAt, songIndex]);

  // Time's up: the clip stops, the alarm wails, and the backing track fades slowly back in behind it.
  const alarmed = useRef(false);
  useEffect(() => {
    if (six.finished) {
      if (alarmed.current) return;
      alarmed.current = true;
      audio.stopTrack(false);
      // Hold the backing track: every click (and the alarm itself) runs ensure(), which would otherwise start it at once.
      audio.pauseBackground();
      audio.sfx('alarm');
      const id = window.setTimeout(() => audio.resumeBackground(8), 3500);
      return () => window.clearTimeout(id);
    }
    alarmed.current = false;
    if (!six.startedAt) audio.stopTrack();
  }, [six.finished, six.startedAt]);
  useEffect(() => () => audio.stopTrack(), []);

  // Warm up the next clip and portrait so they are ready the instant the pause is over.
  useEffect(() => {
    if (!running) return;
    const next = order[pos + 1];
    if (next === undefined) return;
    const el = new Audio(SONGS[next].file);
    el.preload = 'auto';
    el.load();
    const img = new Image();
    img.src = SONGS[next].image;
  }, [running, order, pos]);

  // T = Tittel, A = Artist, N = hopp over sangen.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 't') press('title');
      else if (k === 'a') press('artist');
      else if (k === 'n') skipSong();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pos, inGap, six.gotTitle, six.gotArtist]);

  const start = (): void => {
    audio.sfx('click');
    const t = Date.now();
    update((s) => ({
      ...s,
      six: { startedAt: t, finished: false, order: shuffledOrder(), pos: 0, songStartedAt: t, gotTitle: false, gotArtist: false, played: [] },
    }));
  };

  const press = (which: 'title' | 'artist'): void => {
    if (inGap) return;
    if ((which === 'title' && six.gotTitle) || (which === 'artist' && six.gotArtist)) return;
    audio.sfx('ding');
    reveal(which);
  };

  const skipSong = (): void => {
    if (inGap) return;
    audio.sfx('whoosh');
    timeUp(pos);
  };

  const skipToAlarm = (): void => {
    update((s) => ({ ...s, six: { ...(s.six ?? { finished: false }), startedAt: s.six?.startedAt ?? Date.now(), finished: true } }));
  };

  const abort = (): void => {
    if (!window.confirm('Avbryte og starte på nytt?')) return;
    audio.sfx('back');
    update((s) => ({ ...s, six: undefined }));
  };

  /** On to "who lost": the team(s) with the most titles and artists get the bonus. */
  const toRank = (): void => {
    audio.stopMusic(0.2);
    audio.sfx('click');
    const best = Math.max(0, ...stats.map((s) => s.total));
    const winners = best > 0 ? stats.filter((s) => s.total === best) : [];
    const bonus: Record<TeamId, number> = {};
    for (const w of winners) bonus[w.team.id] = MOST_BONUS;
    const note = winners.length
      ? `Flest riktige: ${winners.map((w) => `${w.team.name} (${w.total})`).join(' og ')} → +${MOST_BONUS} poeng${winners.length > 1 ? ' hver' : ''}.`
      : 'Ingen tok noen sanger, så ingen bonus.';
    update((s) => ({ ...s, pending: { ...(s.pending ?? {}), bonus, note } }));
    go({ name: 'event-rank', index });
  };

  if (six.finished) {
    return (
      <div className="screen six six-finished">
        <div className="six-alarm-text">TIDEN ER UTE!</div>
        <div className="six-alarm-sub">{Math.round(event.durationSec / 60)} minutter har gått</div>
        {song && (
          <div className="six-last six-last-final">
            <div className="six-last-kicker">Riktig sang var</div>
            <div className="six-last-row">
              <img className="six-last-img" src={song.image} alt="" />
              <div>
                <div className="six-last-title">{song.title}</div>
                <div className="six-last-artist">{song.artist}</div>
              </div>
            </div>
          </div>
        )}
        <StatsTable stats={stats} compact={false} />
        <button className="btn btn-primary btn-xl" data-primary onClick={toRank}>
          Stopp alarmen – hvem tapte? →
        </button>
      </div>
    );
  }

  if (running && song) {
    const songElapsed = Math.min(SONG_SEC, Math.max(0, (now - songStartedAt) / 1000));
    const progress = inGap ? 1 : songElapsed / SONG_SEC;
    const gapLeft = inGap ? Math.max(0, Math.ceil((six.gapUntil! - now) / 1000)) : 0;
    const titleOpen = !!six.gotTitle || inGap;
    const artistOpen = !!six.gotArtist || inGap;
    return (
      <div className={`screen six six-running six-quiz ${inGap ? 'six-in-gap' : ''}`}>
        {turnTeam && (
          <aside className="six-turn" style={{ ['--team' as string]: turnTeam.color }}>
            <div className="six-turn-kicker">Sin tur</div>
            <div className="six-turn-mark">
              <TeamMark team={turnTeam} />
            </div>
            <div className="six-turn-name">{turnTeam.name}</div>
          </aside>
        )}

        <div className="six-quiz-head">
          <span className="six-quiz-hint">{inGap ? `Neste sang om ${gapLeft}…` : ''}</span>
        </div>

        <div className="six-tiles" key={`${songStartedAt}-${songIndex}`}>
          <Tile which="title" label="Tittel" keyHint="T" open={titleOpen} got={!!six.gotTitle} song={song} onPress={() => press('title')} onUndo={() => undo('title')} />
          <div className={`six-eq ${inGap ? 'six-eq-quiet' : ''}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <Tile which="artist" label="Artist" keyHint="A" open={artistOpen} got={!!six.gotArtist} song={song} onPress={() => press('artist')} onUndo={() => undo('artist')} />
        </div>

        <div className="six-progress" aria-hidden="true">
          <div className={`six-progress-bar ${inGap ? 'six-progress-gap' : ''}`} style={{ transform: `scaleX(${progress})` }} />
        </div>

        {lastSong && (
          <div className="six-prev">
            Forrige sang: <strong>{lastSong.title}</strong> · {lastSong.artist}
          </div>
        )}

        <StatsTable stats={stats} compact />

        <div className="six-side-actions">
          <button className="btn btn-ghost" onClick={skipSong} disabled={inGap}>
            Hopp over sangen (N)
          </button>
          <button className="btn btn-ghost" onClick={skipToAlarm}>
            Hopp til alarmen
          </button>
          <button className="btn btn-ghost six-abort" onClick={abort}>
            Avbryt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen six six-ready">
      <div className="six-big-emoji">🎧</div>
      <h1 className="play-title">{event.title}</h1>
      <p className="play-sub">
        Når du trykker start, skjules klokken og første sang spilles. Lagene bytter på, én sang hver – {teams[0]?.name ?? 'lag 1'} begynner. Trykk
        Tittel eller Artist når laget tar den, så kommer svaret i boksen og laget deler ut {SIPS} slurker. Laget med flest riktige får{' '}
        {MOST_BONUS} poeng ekstra. Alarmen går etter {Math.round(event.durationSec / 60)} minutter.
      </p>
      <button className="btn btn-primary btn-xl btn-start" data-primary onClick={start}>
        START
      </button>
    </div>
  );
}

/* ---------- pieces ---------- */

interface TeamStat {
  team: Team;
  titles: number;
  artists: number;
  total: number;
}

/** Titles and artists per team, including the boxes open for the song playing now. */
function tally(teams: Team[], six: SixState): TeamStat[] {
  const played = six.played ?? [];
  const turn = teams.length ? teams[played.length % teams.length]?.id : undefined;
  return teams.map((team) => {
    let titles = 0;
    let artists = 0;
    for (const p of played) {
      if (p.team !== team.id) continue;
      if (p.title) titles += 1;
      if (p.artist) artists += 1;
    }
    if (six.startedAt && !six.finished && turn === team.id) {
      if (six.gotTitle) titles += 1;
      if (six.gotArtist) artists += 1;
    }
    return { team, titles, artists, total: titles + artists };
  });
}

function StatsTable({ stats, compact }: { stats: TeamStat[]; compact: boolean }) {
  const best = Math.max(0, ...stats.map((s) => s.total));
  return (
    <table className={`six-stats ${compact ? 'six-stats-compact' : 'six-stats-big'}`}>
      <thead>
        <tr>
          <th>Lag</th>
          <th title="Titler">🎵</th>
          <th title="Artister">🎤</th>
          <th>Sum</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => (
          <tr key={s.team.id} className={best > 0 && s.total === best ? 'six-stats-lead' : ''} style={{ ['--team' as string]: s.team.color }}>
            <td>
              <TeamMark team={s.team} /> {s.team.name}
            </td>
            <td>{s.titles}</td>
            <td>{s.artists}</td>
            <td>
              <strong>{s.total}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface TileProps {
  which: 'title' | 'artist';
  label: string;
  keyHint: string;
  /** The answer is showing (pressed, or opened by the clock). */
  open: boolean;
  /** The answer was pressed by the host, so sips are handed out. */
  got: boolean;
  song: Song;
  onPress: () => void;
  onUndo: () => void;
}

function Tile({ which, label, keyHint, open, got, song, onPress, onUndo }: TileProps) {
  const answer = which === 'title' ? song.title : song.artist;
  return (
    <div
      role="button"
      tabIndex={open ? -1 : 0}
      className={`six-tile six-tile-${which} ${open ? 'six-tile-open' : ''} ${got ? 'six-tile-got' : open ? 'six-tile-missed' : ''}`}
      onClick={open ? undefined : onPress}
      onKeyDown={(e) => {
        if (!open && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPress();
        }
      }}
    >
      <span className="six-tile-label">{label}</span>
      {open ? (
        <>
          {which === 'title' ? <SongScene song={song} /> : <img className="six-tile-img" src={song.image} alt="" draggable={false} />}
          <span className={`six-tile-answer ${answer.length > 24 ? 'six-tile-answer-long' : ''}`}>{answer}</span>
          {got && <span className="six-tile-sips">🍻 Del ut {SIPS} slurker</span>}
          {got && (
            <button
              type="button"
              className="six-tile-undo"
              title="Angre – trykket feil"
              onClick={(e) => {
                e.stopPropagation();
                onUndo();
              }}
            >
              ↩ Angre
            </button>
          )}
        </>
      ) : (
        <span className="six-tile-q">?</span>
      )}
      <span className="six-tile-key">{keyHint}</span>
    </div>
  );
}

/** The little emoji scene that belongs to a song, moving the way the song feels. */
function SongScene({ song }: { song: Song }) {
  return (
    <span className={`six-scene six-scene-${song.motion}`} aria-hidden="true">
      {song.scene.map((e, i) => (
        <span key={i} className="six-scene-item" style={{ ['--i' as string]: i }}>
          {e}
        </span>
      ))}
    </span>
  );
}
