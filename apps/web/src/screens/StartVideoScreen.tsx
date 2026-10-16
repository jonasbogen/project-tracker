import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { Portal } from '../components/Portal';
import type { ScreenProps } from './common';

const SRC = '/teams-video-2.mp4';

/** The small print over the video: one clause at a time, straight-faced. */
const LEGAL: string[] = [
  'Claude fraskriver seg alt ansvar for innhold, poengsummer, og vennskap som går tapt i løpet av kvelden.',
  'Alle forsøk på innsyn i applikasjonen vil bli ansett som forsøk på informasjonsinnhenting uten rettslig grunnlag, og kan straffes med inntil 1 chug.',
  'Kildekoden er beskyttet av passord, god tro og en halvfull Smirnoff Ice. Passordet er ikke 2019.',
  'Spill-lederens avgjørelser er endelige, vilkårlige og kan ikke ankes. Klager leveres skriftlig i bunnen av glasset.',
  'Enhver likhet med faktiske ledere, management graduates eller kolleger er helt tilsiktet.',
  'Hesten «Sponsen» er offisielt sponset av Intility. Ingen av de andre hestene er sponset av noe som helst.',
  'Produktet er ikke testet på dyr. Kun på Lag 1 til 4.',
  'Ved å se videre godtar du vilkårene, husreglene og at «6 minutter» kan vare i mer enn 6 minutter.',
];
const LEGAL_MS = 3400;

/**
 * Plays the second Teams video full screen between "Start spillet" and the
 * intro. Starts by itself (we arrive here from a click) and moves on the
 * moment it ends. The backing track keeps playing underneath; the video's
 * own (near-empty) audio track is muted so the two never fight.
 */
export function StartVideoScreen({ go }: ScreenProps) {
  const done = useRef(false);
  const [clause, setClause] = useState(0);

  const next = (): void => {
    if (done.current) return;
    done.current = true;
    go({ name: 'intro' });
  };

  useEffect(() => {
    audio.resumeBackground();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClause((c) => (c + 1) % LEGAL.length), LEGAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="screen">
      <Portal>
        <div className="netfail netfail-video">
          <video src={SRC} autoPlay muted playsInline onEnded={next} onError={next} />
          <div className="startvideo-stamp" aria-hidden="true">
            Konfidensielt · kun for interne øyne
          </div>
          <div className="startvideo-legal" aria-live="polite">
            <div className="startvideo-legal-kicker">
              Vilkår og ansvarsfraskrivelse · § {clause + 1} av {LEGAL.length}
            </div>
            <p key={clause} className="startvideo-legal-text">
              {LEGAL[clause]}
            </p>
          </div>
          <button type="button" className="startvideo-skip" onClick={next} title="Hopp over">
            Hopp over ›
          </button>
        </div>
      </Portal>
    </div>
  );
}
