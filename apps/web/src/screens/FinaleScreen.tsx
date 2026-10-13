import { useEffect, useState } from 'react';
import { audio } from '../audio/engine';
import { Confetti } from '../components/Confetti';
import { Portal } from '../components/Portal';
import { Scoreboard } from '../components/Scoreboard';
import { standings } from '../game/scoring';
import type { ScreenProps } from './common';
import { PodiumRow } from './PodiumScreen';

/** The song from the third Teams video, sound only. */
const SONG = '/finale.m4a';
/** The photos behind the results, in the order they roll. */
const PHOTOS = ['/finale-1.jpg', '/finale-2.jpg', '/finale-3.jpg'];
/** How long each photo stays before the next one fades in. */
const PHOTO_MS = 6500;

/**
 * The finale after the podium's "Videre": the setup page is back underneath,
 * covered by the podium and the results, with the photos rolling behind as a
 * slow cavalcade and the finale song playing on top of everything. Leaving the
 * screen stops the song and hands the sound back to the backing track.
 */
export function FinaleScreen({ state, update, go }: ScreenProps) {
  const rows = standings(state.teams, state.results);
  const first = rows.filter((r) => r.rank === 1);
  const rest = rows.filter((r) => r.rank > 3);
  const [photo, setPhoto] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    audio.playTrack(SONG, true);
    const reveal = window.setTimeout(() => setShown(true), 400);
    const id = window.setInterval(() => setPhoto((p) => (p + 1) % PHOTOS.length), PHOTO_MS);
    return () => {
      window.clearTimeout(reveal);
      window.clearInterval(id);
      audio.stopTrack();
    };
  }, []);

  const muted = state.settings.muted;

  return (
    <Portal>
      <div className={`finale ${shown ? 'finale-shown' : ''}`}>
        <div className="finale-photos" aria-hidden="true">
          {PHOTOS.map((src, i) => (
            <div
              key={src}
              className={`finale-photo ${i === photo ? 'finale-photo-on' : ''} finale-photo-${i % 3}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
          <div className="finale-shade" />
        </div>
        <Confetti active colors={rows.map((r) => r.team.color)} />

        <div className="finale-inner">
          <div className="finale-kicker">Sosial Grunnmur · Premieutdeling</div>
          <h1 className="podium-title finale-title">🏆 Vinner: {first.map((r) => r.team.name).join(' og ')}</h1>
          <div className="finale-podium">
            <PodiumRow rows={rows} />
          </div>
          {rest.length > 0 && <p className="podium-rest finale-rest">{rest.map((r) => `${r.rank}. ${r.team.name} (${r.total} p)`).join(' · ')}</p>}
          <div className="finale-board">
            <Scoreboard teams={state.teams} results={state.results} compact />
          </div>
        </div>

        <div className="finale-bar">
          <span className="finale-note">Takk for i kveld</span>
          <div className="finale-actions">
            <button
              className="btn btn-icon"
              title={muted ? 'Skru på lyd (M)' : 'Demp (M)'}
              onClick={() => update((s) => ({ ...s, settings: { ...s.settings, muted: !s.settings.muted } }))}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => go({ name: 'setup' })}>
              Tilbake til hovedsiden
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
