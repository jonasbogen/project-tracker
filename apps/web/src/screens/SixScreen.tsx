import { useEffect, useRef, useState } from 'react';
import { TeamMark } from '../components/TeamMark';
import { audio } from '../audio/engine';
import { GAP_SEC, ICE_AT_SEC, ICE_SONG, MOST_BONUS, SIPS, SONGS, SONG_SEC, shuffledOrder, type Song } from '../game/songs';
import type { SixState, Team, TeamId } from '../game/types';
import type { ScreenProps } from './common';

/** How long the alarm screen stays (song, team, loser, table) before the result opens by itself. */
const RESULT_AFTER_MS = 10000;

/**
 * 6 minutter: a hidden six-minute clock with a song quiz on top. Twenty
 * seconds of each song play (audio only, the recordings are never shown).
 * The teams take turns, one song each, team 1 first; the team whose turn it
 * is shouts out the title and the artist, and the host presses the Tittel
 * box or the Artist box when they get it. An open box shows its answer (the
 * title with a little emoji scene, the artist with a portrait) and "del ut
 * 5 slurker"; a small undo in its corner closes it again. "Neste" or the
 * end of the twenty seconds opens what is left and, after a two-second
 * silent pause, the next song and team come up; points already pressed stay.
 *
 * The Ice round: at the first song change after 3:40 the clock stops, the
 * Smirnoff Ice song plays and the team whose turn it is may chug an Ice to
 * double the points on their song. Teams that chugged in the horse race are
 * skipped (the round waits a song). "Videre til sangen" starts the song and
 * the clock again.
 *
 * A table bottom-left keeps count per team, leader on top (ties go to the
 * team that used fewer songs); the leader gets 2 extra points at the alarm.
 * Nothing on screen says how many songs have played.
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
  const ice = six.ice;
  const weight = six.weight ?? 1;
  const played = six.played ?? [];
  const last = played.length ? played[played.length - 1] : undefined;
  const lastSong = last ? SONGS[last.song] : undefined;
  // Team 1 opens, then one song per team round and round.
  const turnTeam: Team | undefined = teams.length ? teams[played.length % teams.length] : undefined;
  const iceTeam = ice ? teams.find((t) => t.id === ice.team) : undefined;

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

  // The hidden clock, minus the time it stood still for the Ice round.
  useEffect(() => {
    if (!running) return;
    if (elapsedSec(six, now) >= event.durationSec) {
      update((s) => ({ ...s, six: { ...(s.six ?? { finished: false }), finished: true, ice: undefined } }));
    }
  }, [now, running, six, event.durationSec, update]);

  /** Opens a box. When both are open the pause before the next song begins. */
  const reveal = (which: 'title' | 'artist'): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || cur.gapUntil || cur.ice) return s;
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
      if (!cur || !cur.startedAt || cur.finished || cur.ice) return s;
      return { ...s, six: { ...cur, gotTitle: which === 'title' ? false : cur.gotTitle, gotArtist: which === 'artist' ? false : cur.gotArtist, gapUntil: undefined } };
    });
  };

  /** "Neste" or the twenty seconds are up: open what is left and start the pause. Points pressed so far stay. */
  const timeUp = (expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || cur.gapUntil || cur.ice || (cur.pos ?? 0) !== expectedPos) return s;
      return { ...s, six: { ...cur, gapUntil: Date.now() + GAP_SEC * 1000 } };
    });
  };

  /** The pause is over: book the song for the team and start the next one, or stop for the Ice round first. */
  const advance = (expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || !cur.gapUntil || (cur.pos ?? 0) !== expectedPos) return s;
      const curOrder = cur.order ?? shuffledOrder();
      const curSong = curOrder[cur.pos ?? 0];
      const prev = cur.played ?? [];
      const team = s.teams.length ? s.teams[prev.length % s.teams.length].id : '';
      const nextPlayed = [
        ...prev,
        ...(curSong !== undefined ? [{ song: curSong, team, title: !!cur.gotTitle, artist: !!cur.gotArtist, weight: cur.weight ?? 1 }] : []),
      ];
      let nextOrder = curOrder;
      let nextPos = (cur.pos ?? 0) + 1;
      if (nextPos >= curOrder.length) {
        // Every song has been played once: new shuffle, the opener up front again.
        nextOrder = shuffledOrder();
        nextPos = 0;
      }
      const t = Date.now();
      const base: SixState = { ...cur, order: nextOrder, pos: nextPos, gotTitle: false, gotArtist: false, gapUntil: undefined, weight: 1, played: nextPlayed };

      // The Ice round: first song change after 3:40, for a team that has not had its Ice chance yet tonight.
      const nextTeam = s.teams.length ? s.teams[nextPlayed.length % s.teams.length] : undefined;
      const excluded = new Set(s.iceOffered ?? []);
      if (!cur.iceDone && nextTeam && elapsedSec(cur, t) >= ICE_AT_SEC) {
        if (s.teams.every((tm) => excluded.has(tm.id))) {
          // Nobody is eligible; the round is simply skipped.
          return { ...s, six: { ...base, iceDone: true, songStartedAt: t } };
        }
        if (!excluded.has(nextTeam.id)) {
          return {
            ...s,
            iceOffered: [...(s.iceOffered ?? []), nextTeam.id],
            six: { ...base, ice: { team: nextTeam.id }, pausedAt: t, songStartedAt: undefined },
          };
        }
        // This team already had its chance: wait a song.
      }
      return { ...s, six: { ...base, songStartedAt: t } };
    });
  };

  /** The team has decided; "Videre til sangen": the song and the clock start again. */
  const iceGo = (): void => {
    audio.sfx('whoosh');
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.ice || cur.ice.doubled === undefined) return s;
      const t = Date.now();
      const pausedMs = (cur.pausedMs ?? 0) + (cur.pausedAt ? t - cur.pausedAt : 0);
      const iceTeams = cur.ice.doubled && !(s.iceTeams ?? []).includes(cur.ice.team) ? [...(s.iceTeams ?? []), cur.ice.team] : s.iceTeams;
      return { ...s, iceTeams, six: { ...cur, ice: undefined, iceDone: true, pausedAt: undefined, pausedMs, weight: cur.ice.doubled ? 2 : 1, songStartedAt: t } };
    });
  };

  const iceChoose = (doubled: boolean): void => {
    audio.sfx(doubled ? 'cheer' : 'click');
    update((s) => (s.six?.ice ? { ...s, six: { ...s.six, ice: { ...s.six.ice, doubled } } } : s));
  };

  const timeUpRef = useRef(timeUp);
  timeUpRef.current = timeUp;

  // Song timer and pause timer, driven by the clock so a refresh picks them up again.
  useEffect(() => {
    if (!running || ice) return;
    if (inGap) {
      if (now >= six.gapUntil!) advance(pos);
    } else if (six.songStartedAt && now - songStartedAt >= SONG_SEC * 1000) {
      timeUp(pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, running, inGap, ice, songStartedAt, pos]);

  // The song that is playing: 20 seconds of audio, re-synced to songStartedAt after a refresh.
  // In the pause the clip is stopped and the room is silent; the backing track stays held.
  // In the Ice round the Ice song loops instead.
  useEffect(() => {
    if (!running || !song) return;
    if (ice) {
      audio.playTrack(ICE_SONG, true);
      return;
    }
    if (inGap || !six.songStartedAt) {
      audio.stopTrack(false);
      return;
    }
    const offset = Math.max(0, (Date.now() - songStartedAt) / 1000);
    if (offset >= SONG_SEC) return; // the timer effect opens the pause
    audio.playTrack(song.file, false, { offset, onEnded: () => timeUpRef.current(pos) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, inGap, !!ice, songStartedAt, songIndex]);

  // Time's up: the clip stops, the alarm wails, and the backing track fades slowly back in behind it.
  // The alarm screen moves on to the result by itself; the host does not have to press anything.
  const alarmed = useRef(false);
  const finishedAt = useRef<number | null>(null);
  const toRankRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (six.finished) {
      if (alarmed.current) return;
      alarmed.current = true;
      finishedAt.current = Date.now();
      audio.stopTrack(false);
      // Hold the backing track: every click (and the alarm itself) runs ensure(), which would otherwise start it at once.
      audio.pauseBackground();
      audio.sfx('alarm');
      const id = window.setTimeout(() => audio.resumeBackground(8), 3500);
      const go = window.setTimeout(() => toRankRef.current(), RESULT_AFTER_MS);
      return () => {
        window.clearTimeout(id);
        window.clearTimeout(go);
      };
    }
    alarmed.current = false;
    finishedAt.current = null;
    if (!six.startedAt) audio.stopTrack();
  }, [six.finished, six.startedAt]);
  useEffect(() => () => audio.stopTrack(), []);

  // The clock keeps ticking on the alarm screen too, for the countdown to the result.
  useEffect(() => {
    if (!six.finished) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [six.finished]);

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

  // T = Tittel, A = Artist, N = Neste.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 't') press('title');
      else if (k === 'a') press('artist');
      else if (k === 'n') nextSong();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pos, inGap, !!ice, six.gotTitle, six.gotArtist]);

  const start = (): void => {
    audio.sfx('click');
    const t = Date.now();
    update((s) => ({
      ...s,
      six: { startedAt: t, finished: false, order: shuffledOrder(), pos: 0, songStartedAt: t, gotTitle: false, gotArtist: false, weight: 1, pausedMs: 0, played: [] },
    }));
  };

  const press = (which: 'title' | 'artist'): void => {
    if (inGap || ice) return;
    if ((which === 'title' && six.gotTitle) || (which === 'artist' && six.gotArtist)) return;
    audio.sfx('ding');
    reveal(which);
  };

  const nextSong = (): void => {
    if (inGap || ice) return;
    audio.sfx('whoosh');
    timeUp(pos);
  };

  const skipToAlarm = (): void => {
    update((s) => ({ ...s, six: { ...(s.six ?? { finished: false }), startedAt: s.six?.startedAt ?? Date.now(), finished: true, ice: undefined } }));
  };

  const abort = (): void => {
    if (!window.confirm('Avbryte og starte på nytt?')) return;
    audio.sfx('back');
    update((s) => ({ ...s, six: undefined }));
  };

  /**
   * On to the result: the team whose turn it was when the alarm went is the
   * loser (no asking), and the leader(s) of the table get the bonus. The
   * ranking page is skipped; App.tsx commits the pending result straight away.
   */
  const toRank = (): void => {
    audio.stopMusic(0.2);
    audio.sfx('click');
    const top = stats[0];
    const winners = top && top.total > 0 ? stats.filter((s) => s.total === top.total && s.songs === top.songs) : [];
    const bonus: Record<TeamId, number> = {};
    for (const w of winners) bonus[w.team.id] = MOST_BONUS;
    const loserNote = turnTeam ? `${turnTeam.name} hadde tur da alarmen gikk: −${Math.abs(event.penalty)} poeng, og alle på laget tar ${SIPS} slurker selv.` : '';
    const bonusNote = winners.length
      ? `Flest riktige: ${winners.map((w) => `${w.team.name} (${w.total})`).join(' og ')} → +${MOST_BONUS} poeng${winners.length > 1 ? ' hver' : ''}.`
      : 'Ingen tok noen sanger, så ingen bonus.';
    update((s) => ({ ...s, pending: { ...(s.pending ?? {}), loser: turnTeam?.id, bonus, note: `${loserNote} ${bonusNote}`.trim() } }));
    go({ name: 'event-rank', index });
  };
  toRankRef.current = toRank;

  if (six.finished) {
    const left = Math.max(0, Math.ceil((RESULT_AFTER_MS - (now - (finishedAt.current ?? now))) / 1000));
    return (
      <div className="screen six six-finished">
        <div className="six-alarm-text">TIDEN ER UTE!</div>
        <div className="six-alarm-sub">{Math.round(event.durationSec / 60)} minutter har gått</div>
        {song && (
          <div className="six-last six-last-final" style={turnTeam ? { ['--team' as string]: turnTeam.color } : undefined}>
            <div className="six-last-kicker">Riktig sang var</div>
            <div className="six-last-row">
              <img className="six-last-img" src={song.image} alt="" />
              <div>
                <div className="six-last-title">{song.title}</div>
                <div className="six-last-artist">{song.artist}</div>
              </div>
            </div>
            {turnTeam && (
              <div className="six-alarm-who">
                Det var <TeamMark team={turnTeam} /> <strong>{turnTeam.name}</strong> som skulle gjette denne.
              </div>
            )}
          </div>
        )}
        {turnTeam && (
          <div className="six-loser-card six-alarm-loser" style={{ ['--team' as string]: turnTeam.color }}>
            <span className="six-loser-emoji">
              <TeamMark team={turnTeam} />
            </span>
            <span className="six-loser-name">{turnTeam.name} tapte 6 minutter</span>
            <span className="six-loser-points">−{Math.abs(event.penalty)}</span>
            <span className="six-alarm-sips">🍻 Alle på laget tar {SIPS} slurker selv</span>
          </div>
        )}
        <StatsTable stats={stats} compact={false} />
        <button className="btn btn-primary btn-xl" data-primary onClick={toRank}>
          Resultatet kommer om {left}… (trykk for å gå nå) →
        </button>
      </div>
    );
  }

  if (running && song) {
    const songElapsed = six.songStartedAt ? Math.min(SONG_SEC, Math.max(0, (now - songStartedAt) / 1000)) : 0;
    const progress = inGap ? 1 : songElapsed / SONG_SEC;
    const gapLeft = inGap ? Math.max(0, Math.ceil((six.gapUntil! - now) / 1000)) : 0;
    const titleOpen = !!six.gotTitle || inGap;
    const artistOpen = !!six.gotArtist || inGap;
    const showTeam = ice ? iceTeam : turnTeam;
    return (
      <div className={`screen six six-running six-quiz ${inGap ? 'six-in-gap' : ''} ${ice ? 'six-in-ice' : ''}`}>
        {showTeam && (
          <aside className="six-turn" style={{ ['--team' as string]: showTeam.color }}>
            <div className="six-turn-kicker">Sin tur</div>
            <div className="six-turn-mark">
              <TeamMark team={showTeam} />
            </div>
            <div className="six-turn-name">{showTeam.name}</div>
            {!ice && weight > 1 && <div className="six-turn-double">🧊 Doble poeng</div>}
          </aside>
        )}

        {ice && iceTeam ? (
          <div className="six-ice" style={{ ['--team' as string]: iceTeam.color }}>
            <div className="six-ice-kicker">Klokken står stille</div>
            <h2 className="six-ice-title">🧊 ICE-RUNDE</h2>
            <p className="six-ice-text">
              <strong>{iceTeam.name}</strong> står for tur. Chugg en Smirnoff Ice og doble poengene på sangen som kommer: tittel 2 poeng, artist 2
              poeng.
            </p>
            <div className="six-ice-choices">
              <button type="button" className={`btn btn-xl six-ice-yes ${ice.doubled === true ? 'six-ice-on' : ''}`} onClick={() => iceChoose(true)}>
                🍾 Vi tar en Ice – doble poeng
              </button>
              <button type="button" className={`btn btn-ghost btn-xl ${ice.doubled === false ? 'six-ice-on' : ''}`} onClick={() => iceChoose(false)}>
                Nei takk
              </button>
            </div>
            <button type="button" className="btn btn-primary btn-xl" data-primary disabled={ice.doubled === undefined} onClick={iceGo}>
              Videre til sangen →
            </button>
          </div>
        ) : (
          <>
            <div className="six-quiz-head">
              <span className="six-quiz-hint">{inGap ? `Neste sang om ${gapLeft}…` : ''}</span>
            </div>

            <div className="six-tiles" key={`${songStartedAt}-${songIndex}`}>
              <Tile which="title" label="Tittel" keyHint="T" open={titleOpen} got={!!six.gotTitle} weight={weight} song={song} onPress={() => press('title')} onUndo={() => undo('title')} />
              <div className={`six-eq ${inGap ? 'six-eq-quiet' : ''}`} aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} style={{ ['--i' as string]: i }} />
                ))}
              </div>
              <Tile which="artist" label="Artist" keyHint="A" open={artistOpen} got={!!six.gotArtist} weight={weight} song={song} onPress={() => press('artist')} onUndo={() => undo('artist')} />
            </div>

            <div className="six-progress" aria-hidden="true">
              <div className={`six-progress-bar ${inGap ? 'six-progress-gap' : ''}`} style={{ transform: `scaleX(${progress})` }} />
            </div>

            {lastSong && (
              <div className="six-prev">
                Forrige sang: <strong>{lastSong.title}</strong> · {lastSong.artist}
              </div>
            )}
          </>
        )}

        <StatsTable stats={stats} compact />

        <div className="six-side-actions">
          {!ice && (
            <button className="btn btn-primary six-next" onClick={nextSong} disabled={inGap}>
              Neste →
            </button>
          )}
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
        Tittel eller Artist når laget tar den, så kommer svaret i boksen og laget deler ut {SIPS} slurker. Underveis stopper klokken for en
        Ice-runde med doble poeng. Laget med flest riktige får {MOST_BONUS} poeng ekstra. Alarmen går etter {Math.round(event.durationSec / 60)}{' '}
        minutter.
      </p>
      <button className="btn btn-primary btn-xl btn-start" data-primary onClick={start}>
        START
      </button>
    </div>
  );
}

/* ---------- pieces ---------- */

/** Seconds the hidden clock has run, not counting the time it stood still. */
function elapsedSec(six: SixState, now: number): number {
  if (!six.startedAt) return 0;
  const paused = (six.pausedMs ?? 0) + (six.pausedAt ? now - six.pausedAt : 0);
  return Math.max(0, (now - six.startedAt - paused) / 1000);
}

interface TeamStat {
  team: Team;
  titles: number;
  artists: number;
  total: number;
  /** Songs the team has had (the one playing counts once they score on it). */
  songs: number;
}

/**
 * Points per team, including the boxes open for the song playing now, sorted
 * with the leader on top. Equal points: the team that used fewer songs wins.
 */
function tally(teams: Team[], six: SixState): TeamStat[] {
  const played = six.played ?? [];
  const turn = teams.length ? teams[played.length % teams.length]?.id : undefined;
  const rows = teams.map((team, i) => {
    let titles = 0;
    let artists = 0;
    let songs = 0;
    for (const p of played) {
      if (p.team !== team.id) continue;
      songs += 1;
      const w = p.weight ?? 1;
      if (p.title) titles += w;
      if (p.artist) artists += w;
    }
    if (six.startedAt && !six.finished && turn === team.id && (six.gotTitle || six.gotArtist)) {
      const w = six.weight ?? 1;
      songs += 1;
      if (six.gotTitle) titles += w;
      if (six.gotArtist) artists += w;
    }
    return { team, titles, artists, total: titles + artists, songs, i };
  });
  rows.sort((a, b) => b.total - a.total || a.songs - b.songs || a.i - b.i);
  return rows.map(({ i: _i, ...r }) => r);
}

function StatsTable({ stats, compact }: { stats: TeamStat[]; compact: boolean }) {
  const top = stats[0];
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
        {stats.map((s, i) => (
          <tr
            key={s.team.id}
            className={top && top.total > 0 && s.total === top.total && s.songs === top.songs ? 'six-stats-lead' : ''}
            style={{ ['--team' as string]: s.team.color, ['--row' as string]: i }}
          >
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
  /** Points this answer is worth (2 after an Ice). */
  weight: number;
  song: Song;
  onPress: () => void;
  onUndo: () => void;
}

function Tile({ which, label, keyHint, open, got, weight, song, onPress, onUndo }: TileProps) {
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
      {weight > 1 && <span className="six-tile-double">×2</span>}
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
