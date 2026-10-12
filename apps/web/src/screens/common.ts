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
  custom: '🎯',
};

export const RULE_BULLETS: Partial<Record<GameEvent['kind'], string[]>> = {
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
    '15 sekunder per film. Si tittelen høyt – spill-lederen trykker riktig eller feil.',
    'Flest riktige vinner. Ved likt antall vinner laget som brukte minst tid.',
  ],
};

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function nextAfterPoints(state: GameState, index: number): Phase {
  return index + 1 < state.events.length ? { name: 'event-intro', index: index + 1 } : { name: 'podium' };
}
