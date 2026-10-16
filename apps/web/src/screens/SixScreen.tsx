import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { SONGS, SONG_SEC, shuffledOrder } from '../game/songs';
import type { SixReveal, SixState } from '../game/types';
import type { ScreenProps } from './common';

/**
 * 6 minutter: a hidden six-minute clock with a song quiz on top. Twenty
 * seconds of each song play (audio only, the recordings are never shown)
 * while the teams shout out the title or the artist. The host presses
 * Tittel or Artist: the answer for the song that was just playing appears
 * in the "Forrige sang" card and the next song starts at once, so the two
 * tiles always belong to the song that is audible. After twenty seconds
 * without a press the song is given away as "Ingen tok den" and the next
 * one starts. The alarm ends it all.
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
  const last = six.played?.length ? six.played[six.played.length - 1] : undefined;
  const lastSong = last ? SONGS[last.song] : undefined;
  const songNo = (six.played?.length ?? 0) + 1;

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

  /** Moves to the next song; `by` says how the one playing now was resolved. */
  const advance = (by: SixReveal, expectedPos: number): void => {
    update((s) => {
      const cur = s.six;
      if (!cur || !cur.startedAt || cur.finished || (cur.pos ?? 0) !== expectedPos) return s;
      const curOrder = cur.order ?? shuffledOrder();
      const curSong = curOrder[cur.pos ?? 0];
      const played = [...(cur.played ?? []), ...(curSong !== undefined ? [{ song: curSong, by }] : [])];
      let nextOrder = curOrder;
      let nextPos = (cur.pos ?? 0) + 1;
      if (nextPos >= curOrder.length) {
        // Every song has been played once: new shuffle, the opener up front again.
        nextOrder = shuffledOrder();
        nextPos = 0;
      }
      return { ...s, six: { ...cur, order: nextOrder, pos: nextPos, songStartedAt: Date.now(), played } };
    });
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // The song that is playing: 20 seconds of audio, re-synced to songStartedAt after a refresh.
  useEffect(() => {
    if (!running || !song) return;
    const offset = Math.max(0, (Date.now() - songStartedAt) / 1000);
    if (offset >= SONG_SEC) {
      advanceRef.current('timeout', pos);
      return;
    }
    audio.playTrack(song.file, false, { offset, onEnded: () => advanceRef.current('timeout', pos) });
    // Safety net in case the clip is longer than 20 s or 'ended' never fires.
    const id = window.setTimeout(() => advanceRef.current('timeout', pos), (SONG_SEC - offset) * 1000 + 150);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, songStartedAt, songIndex]);

  // Hand the sound back to the backing track when the quiz stops or the screen goes away.
  useEffect(() => {
    if (!running) audio.stopTrack();
  }, [running]);
  useEffect(() => () => audio.stopTrack(), []);

  // Warm up the next clip so it starts the instant the host presses.
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
      if (k === 't') reveal('title');
      else if (k === 'a') reveal('artist');
      else if (k === 'n') skipSong();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pos]);

  const start = (): void => {
    audio.sfx('click');
    const t = Date.now();
    update((s) => ({
      ...s,
      six: { startedAt: t, finished: false, order: shuffledOrder(), pos: 0, songStartedAt: t, played: [] },
    }));
  };

  const reveal = (by: 'title' | 'artist'): void => {
    audio.sfx('ding');
    advance(by, pos);
  };

  const skipSong = (): void => {
    audio.sfx('whoosh');
    advance('timeout', pos);
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
        <div className="six-alarm-sub">
          {Math.round(event.durationSec / 60)} minutter har gått · {six.played?.length ?? 0} sanger spilt
        </div>
        {lastSong && (
          <div className="six-last six-last-final">
            <div className="six-last-kicker">Siste sang</div>
            <div className="six-last-title">{lastSong.title}</div>
            <div className="six-last-artist">{lastSong.artist}</div>
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

  if (running) {
    const songElapsed = Math.min(SONG_SEC, Math.max(0, (now - songStartedAt) / 1000));
    const progress = songElapsed / SONG_SEC;
    return (
      <div className="screen six six-running six-quiz">
        <div className="six-quiz-head">
          <span className="six-quiz-no">Sang {songNo}</span>
          <span className="six-quiz-hint">Klokken går i skjul · rop ut tittel eller artist</span>
        </div>

        <div className="six-tiles" key={`${songStartedAt}-${songIndex}`}>
          <button type="button" className="six-tile six-tile-title" onClick={() => reveal('title')}>
            <span className="six-tile-label">Tittel</span>
            <span className="six-tile-q">?</span>
            <span className="six-tile-key">T</span>
          </button>
          <div className="six-eq" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <button type="button" className="six-tile six-tile-artist" onClick={() => reveal('artist')}>
            <span className="six-tile-label">Artist</span>
            <span className="six-tile-q">?</span>
            <span className="six-tile-key">A</span>
          </button>
        </div>

        <div className="six-progress" aria-hidden="true">
          <div className="six-progress-bar" style={{ transform: `scaleX(${progress})` }} />
        </div>

        <div className={`six-last ${last ? 'six-last-in' : 'six-last-empty'}`} key={last ? `${six.played!.length}` : 'none'}>
          {last && lastSong ? (
            <>
              <div className="six-last-kicker">
                Forrige sang ·{' '}
                {last.by === 'title' ? '✅ Tittelen ble tatt' : last.by === 'artist' ? '✅ Artisten ble tatt' : '⏱️ Ingen tok den'}
              </div>
              <div className={`six-last-title ${last.by === 'title' ? 'six-last-hit' : ''}`}>{lastSong.title}</div>
              <div className={`six-last-artist ${last.by === 'artist' ? 'six-last-hit' : ''}`}>{lastSong.artist}</div>
            </>
          ) : (
            <div className="six-last-kicker">Første sang er i gang</div>
          )}
        </div>

        <div className="six-side-actions">
          <button className="btn btn-ghost" onClick={skipSong}>
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
        Når du trykker start, skjules klokken og første sang spilles. 20 sekunder per sang – trykk Tittel eller Artist når noen tar den,
        så kommer svaret opp og neste sang starter. Alarmen går etter {Math.round(event.durationSec / 60)} minutter.
      </p>
      <p className="play-sub">{SONGS.length} sanger i tilfeldig rekkefølge.</p>
      <button className="btn btn-primary btn-xl btn-start" data-primary onClick={start}>
        START
      </button>
    </div>
  );
}
