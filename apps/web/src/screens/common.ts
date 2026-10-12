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
  custom: '🎯',
};

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function nextAfterPoints(state: GameState, index: number): Phase {
  return index + 1 < state.events.length ? { name: 'event-intro', index: index + 1 } : { name: 'podium' };
}
