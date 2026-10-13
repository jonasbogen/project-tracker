import { useEffect, useRef } from 'react';
import { audio } from '../audio/engine';
import { Portal } from '../components/Portal';
import type { ScreenProps } from './common';

const SRC = '/teams-video-2.mp4';

/**
 * Plays the second Teams video full screen between "Start spillet" and the
 * intro. Starts by itself (we arrive here from a click), pauses the backing
 * track meanwhile, and moves on the moment it ends.
 */
export function StartVideoScreen({ go }: ScreenProps) {
  const done = useRef(false);

  const next = (): void => {
    if (done.current) return;
    done.current = true;
    audio.resumeBackground();
    go({ name: 'intro' });
  };

  useEffect(() => {
    audio.pauseBackground();
    return () => audio.resumeBackground();
  }, []);

  return (
    <div className="screen">
      <Portal>
        <div className="netfail netfail-video">
          <video src={SRC} autoPlay playsInline onEnded={next} onError={next} />
          <button type="button" className="startvideo-skip" onClick={next} title="Hopp over">
            Hopp over ›
          </button>
        </div>
      </Portal>
    </div>
  );
}
