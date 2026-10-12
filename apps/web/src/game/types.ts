export type TeamId = string;

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  emoji: string;
  players: string[];
}

export type EventKind = 'six' | 'horse' | 'mafia' | 'custom';

export interface GameEvent {
  id: string;
  kind: EventKind;
  title: string;
  rules: string;
  /** Points for 1st..4th place (ranked events). */
  points: number[];
  /** Points subtracted from the loser (six minutes). */
  penalty: number;
  /** Hidden timer length in seconds (six minutes). */
  durationSec: number;
}

/** Standard competition ranking: 1,2,2,4. Ties share a rank. */
export type Placements = Record<TeamId, number>;

export interface EventResult {
  eventId: string;
  placements?: Placements;
  loser?: TeamId;
  points: Record<TeamId, number>;
  note?: string;
}

export type Phase =
  | { name: 'setup' }
  | { name: 'intro' }
  | { name: 'journey' }
  | { name: 'event-intro'; index: number }
  | { name: 'event-play'; index: number }
  | { name: 'event-rank'; index: number }
  | { name: 'event-points'; index: number }
  | { name: 'podium' };

export type MafiaRole = 'mafia' | 'politi' | 'sivil';

export interface MafiaPlayer {
  id: string;
  name: string;
  teamId: TeamId;
  alive: boolean;
  role?: MafiaRole;
  diedRound?: number;
  diedBy?: 'mafia' | 'vote';
}

export type MafiaStep =
  | 'setup'
  | 'night-sleep'
  | 'night-mafia'
  | 'night-police'
  | 'night-victim'
  | 'day-discuss'
  | 'day-vote'
  | 'reveal-all'
  | 'end';

export interface MafiaState {
  players: MafiaPlayer[];
  mafiaCount: number;
  policeCount: number;
  round: number;
  step: MafiaStep;
  /** Player awaiting role reveal after being killed/lynched. */
  pendingReveal?: string;
  discussStartedAt?: number;
  winner?: 'mafia' | 'byen';
}

export interface SixState {
  startedAt?: number;
  finished: boolean;
}

export interface GameState {
  version: 1;
  teams: Team[];
  events: GameEvent[];
  results: EventResult[];
  phase: Phase;
  /** Pending (auto-suggested) placements for the current event. */
  pending?: { placements?: Placements; loser?: TeamId; note?: string };
  six?: SixState;
  mafia?: MafiaState;
  settings: { muted: boolean; volume: number; discussSec: number };
  updatedAt: number;
}
