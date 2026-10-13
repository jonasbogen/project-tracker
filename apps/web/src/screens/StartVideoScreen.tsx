import { useEffect, useRef } from 'react';
import { audio } from '../audio/engine';
import { Portal } from '../components/Portal';
import type { ScreenProps } from './common';

const SRC = '/teams-video-2.mp4';

/**
 * Plays the second Teams video full screen between "Start spillet" and the
 * intro. Starts by itself (we arrive here from a click) and moves on the
 * moment it ends. The backing track keeps playing underneath; the video's
 * own (near-empty) audio track is muted so the two never fight.
 */
export function StartVideoScreen({ go }: ScreenProps) {
  const done = useRef(false);

  const next = (): void => {
    if (done.current) return;
    done.current = true;
    go({ name: 'intro' });
  };

  useEffect(() => {
    audio.resumeBackground();
  }, []);

  return (
    <div className="screen">
      <Portal>
        <div className="netfail netfail-video">
          <video src={SRC} autoPlay muted playsInline onEnded={next} onError={next} />
          <button type="button" className="startvideo-skip" onClick={next} title="Hopp over">
            Hopp over ›
          </button>
        </div>
      </Portal>
    </div>
  );
}
