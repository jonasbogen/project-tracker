import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { GAP_SEC, SIPS, SONGS, SONG_SEC, shuffledOrder, type Song } from '../game/songs';
import type { SixState } from '../game/types';
import type { ScreenProps } from './common';

/**
 * 6 minutter: a hidden six-minute clock with a song quiz on top. Twenty
 * seconds of each song play (audio only, the recordings are never shown)
 * while the teams shout out the title and the artist. The host presses the
 * Tittel box or the Artist box when someone gets it: the answer appears in
 * that box, with "del ut 5 slurker". Both can be taken. When both boxes are
 * open, or the twenty seconds run out (the unanswered boxes then open on
 * their own), there is a three-second pause with the answers on screen and
 * the next song starts. Nothing on screen says how many songs have played,
 * so nobody can estimate the clock. The alarm ends it all.
 */
export function SixScreen({ state, update, go, index }: ScreenProps & { index: number }) {
  const event = state.events[index];
  const six: SixState = state.six ?? { finished: false };
  const [now, setNow] = useState(Date.now());
  const running = !!six.startedAt && !six.finished;
  const order = six.order ?? [];
  const pos = six.pos ?? 0;
  const songIndex = order[pos];
  const song = songIndex !== undefined ? SONGS[songIndex] : undefined;
  const songStartedAt = six.songStartedAt ?? six.startedAt ?? 0;
  const inGap = !!six.gapUntil;
  const last = six.played?.length ? six.played[six.played.length - 1] : undefined;
  const lastSong = last ? SONGS[last.song] : undefined;

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

  /** The twenty seconds are up (or the host skipped): open what is left and start the pause. */
  const timeUp = (expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || cur.gapUntil || (cur.pos ?? 0) !== expectedPos) return s;
      return { ...s, six: { ...cur, gapUntil: Date.now() + GAP_SEC * 1000 } };
    });
  };

  /** The pause is over: book the song and start the next one. */
  const advance = (expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || !cur.gapUntil || (cur.pos ?? 0) !== expectedPos) return s;
      const curOrder = cur.order ?? shuffledOrder();
      const curSong = curOrder[cur.pos ?? 0];
      const played = [
        ...(cur.played ?? []),
        ...(curSong !== undefined ? [{ song: curSong, title: !!cur.gotTitle, artist: !!cur.gotArtist }] : []),
      ];
      let nextOrder = curOrder;
      let nextPos = (cur.pos ?? 0) + 1;
      if (nextPos >= curOrder.length) {
        // Every song has been played once: new shuffle, the opener up front again.
        nextOrder = shuffledOrder();
        nextPos = 0;
      }
      return {
        ...s,
        six: { ...cur, order: nextOrder, pos: nextPos, songStartedAt: Date.now(), gotTitle: false, gotArtist: false, gapUntil: undefined, played },
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

  // Hand the sound back to the backing track when the quiz stops or the screen goes away.
  useEffect(() => {
    if (!running) audio.stopTrack();
  }, [running]);
  useEffect(() => () => audio.stopTrack(), []);

  // Warm up the next clip so it starts the instant the pause is over.
  useEffect(() => {
    if (!running) return;
    const next = order[pos + 1];
    if (next === undefined) return;
    const el = new Audio(SONGS[next].file);
    el.preload = 'auto';
    el.load();
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

  if (six.finished) {
    return (
      <div className="screen six six-finished">
        <div className="six-alarm-text">TIDEN ER UTE!</div>
        <div className="six-alarm-sub">{Math.round(event.durationSec / 60)} minutter har gått</div>
        {song && (
          <div className="six-last six-last-final">
            <div className="six-last-kicker">Sangen som spilte</div>
            <div className="six-last-title">{song.title}</div>
            <div className="six-last-artist">{song.artist}</div>
          </div>
        )}
        <button
          className="btn btn-primary btn-xl"
          data-primary
          onClick={() => {
            audio.stopMusic(0.2);
            audio.sfx('click');
            go({ name: 'event-rank', index });
          }}
        >
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
        <div className="six-quiz-head">
          <span className="six-quiz-hint">
            {inGap ? `Neste sang om ${gapLeft}…` : 'Klokken går i skjul · rop ut tittel og artist'}
          </span>
        </div>

        <div className="six-tiles" key={`${songStartedAt}-${songIndex}`}>
          <Tile which="title" label="Tittel" keyHint="T" open={titleOpen} got={!!six.gotTitle} song={song} onPress={() => press('title')} />
          <div className={`six-eq ${inGap ? 'six-eq-quiet' : ''}`} aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <Tile which="artist" label="Artist" keyHint="A" open={artistOpen} got={!!six.gotArtist} song={song} onPress={() => press('artist')} />
        </div>

        <div className="six-progress" aria-hidden="true">
          <div className={`six-progress-bar ${inGap ? 'six-progress-gap' : ''}`} style={{ transform: `scaleX(${progress})` }} />
        </div>

        {lastSong && (
          <div className="six-prev">
            Forrige sang: <strong>{lastSong.title}</strong> · {lastSong.artist}
          </div>
        )}

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
        Når du trykker start, skjules klokken og første sang spilles. 20 sekunder per sang. Trykk Tittel eller Artist når noen tar den – svaret
        kommer i boksen, og laget deler ut {SIPS} slurker. Når begge er tatt, eller tiden er ute, kommer neste sang etter {GAP_SEC} sekunder.
        Alarmen går etter {Math.round(event.durationSec / 60)} minutter.
      </p>
      <button className="btn btn-primary btn-xl btn-start" data-primary onClick={start}>
        START
      </button>
    </div>
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
}

function Tile({ which, label, keyHint, open, got, song, onPress }: TileProps) {
  const answer = which === 'title' ? song.title : song.artist;
  return (
    <button
      type="button"
      className={`six-tile six-tile-${which} ${open ? 'six-tile-open' : ''} ${got ? 'six-tile-got' : open ? 'six-tile-missed' : ''}`}
      onClick={onPress}
      disabled={open}
    >
      <span className="six-tile-label">{label}</span>
      {open ? (
        <>
          {which === 'title' && <SongScene song={song} />}
          <span className={`six-tile-answer ${answer.length > 24 ? 'six-tile-answer-long' : ''}`}>{answer}</span>
          <span className={`six-tile-sips ${got ? '' : 'six-tile-sips-none'}`}>{got ? `🍻 Del ut ${SIPS} slurker` : 'Ingen tok den'}</span>
        </>
      ) : (
        <span className="six-tile-q">?</span>
      )}
      <span className="six-tile-key">{keyHint}</span>
    </button>
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
