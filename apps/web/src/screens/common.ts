import type { GameEvent, GameState, Phase } from '../game/types';

export interface ScreenProps {
  state: GameState;
  update: (fn: (s: GameState) => GameState) => void;
  go: (phase: Phase) => void;
}

export const KIND_EMOJI: Record<GameEvent['kind'], string> = {
  six: '⏱️',
  horse: '🐎',
  mafia: '🕵️',
  emoji: '🎬',
  wheel: '🎡',
  deal: '💼',
  custom: '🎯',
};

export const RULE_BULLETS: Partial<Record<GameEvent['kind'], string[]>> = {
  six: [
    'Klokken går i skjul. Ingen får se hvor lenge det er igjen.',
    'Mens den går spilles sanger, 20 sekunder hver. Lagene bytter på, én sang hver – lag 1 begynner.',
    'Laget som har tur roper ut tittel og artist. Spill-lederen trykker boksen når de tar den. Riktig = del ut 5 slurker 🍻',
    'Når begge er tatt, eller tiden er ute, kommer neste sang og neste lag etter en kort pause.',
    '🏆 Laget med flest riktige totalt (titler + artister) får 2 poeng ekstra.',
    'Når alarmen går er det slutt. Laget som tapte får minuspoeng.',
  ],
  mafia: [
    'Kort: ess = mafia, konge = politi, resten er sivile. Ingen viser kortet sitt.',
    'Første natt markerer spill-lederen hvem som er mafia og politi når de våkner.',
    'Natt: mafiaen peker på et offer. Politiet peker på én person – lederen svarer med tommel opp (mafia) eller ned.',
    'Dag: offeret avsløres, byen diskuterer og stemmer ut én person. Flertallet bestemmer.',
    '💀 Den som dør drikker 5 slurker 🍻',
    'Mafiaen vinner når de er like mange som resten. Byen vinner når all mafia er tatt.',
    'Poeng per spiller: 3 for vinnende side + 1 for å overleve. Snitt per lag gir rekkefølgen → 10 / 7 / 5 / 3.',
  ],
  emoji: [
    'Hvert lag får 2 filmer, forklart kun med emojis. Lagene bytter på.',
    '10 sekunder per film. Si tittelen høyt – spill-lederen trykker riktig eller feil.',
    'Bare riktig eller feil teller, ikke tiden. Flest riktige vinner, likt antall deler plassen.',
  ],
  horse: [
    'Hvert lag velger sin egen hest: spar, hjerter, ruter eller kløver. Bare ett lag per hest.',
    'Kort fra bunken bestemmer hvilken hest som rykker fram.',
    'Når alle hestene har passert et sidekort, snus det, og den fargen må rygge ett steg.',
    'Første hest over målstreken vinner.',
  ],
  wheel: [
    'Hjulet har 12 felt. Lagene velger ett felt hver, i rekkefølge. Ett lag per felt.',
    'Hjulet snurres én gang. Stopper det på feltet ditt, får laget 5 poeng.',
    'Bare én runde, så går vi videre.',
  ],
  deal: [
    '20 kofferter med verdier fra 10 til 2500 kroner. Hvert lag velger én koffert som sin egen.',
    'Hvert lag åpner én koffert per runde. Lav verdi = del ut slurker. Høy verdi = laget drikker.',
    'Esko i Banken ringer underveis med et eget tilbud til hvert lag: DEAL eller NO DEAL.',
    'Til slutt åpnes alle lagenes egne kofferter. Lagene rangeres etter hvor mange kroner de sitter igjen med.',
  ],
};

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function nextAfterPoints(state: GameState, index: number): Phase {
  if (state.singleEvent) return { name: 'setup' };
  return index + 1 < state.events.length ? { name: 'event-intro', index: index + 1 } : { name: 'podium' };
}

/** Events already scored, in programme order. */
export function playedEvents(state: GameState): Set<string> {
  return new Set(state.results.map((r) => r.eventId));
}

/** Where "Fortsett spillet" goes: the first unplayed event, or the podium when all are done. */
export function resumePhase(state: GameState): Phase {
  const done = playedEvents(state);
  const index = state.events.findIndex((e) => !done.has(e.id));
  return index >= 0 ? { name: 'event-intro', index } : { name: 'podium' };
}
