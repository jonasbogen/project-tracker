export type TeamId = string;

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  /** Kept for older saves; new teams use an icon instead. */
  emoji: string;
  /** Icon key, see TEAM_ICONS in components/TeamMark. */
  icon?: string;
  players: string[];
}

export type EventKind = 'six' | 'horse' | 'mafia' | 'emoji' | 'wheel' | 'deal' | 'custom';

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
  /** Teams that hit on the wheel (flat points, no ranking). */
  hits?: TeamId[];
  points: Record<TeamId, number>;
  note?: string;
}

export type Phase =
  | { name: 'setup' }
  /** The Teams video that plays right after "Start spillet", before the intro. */
  | { name: 'start-video' }
  | { name: 'intro' }
  | { name: 'event-intro'; index: number }
  | { name: 'event-play'; index: number }
  | { name: 'event-rank'; index: number }
  | { name: 'event-points'; index: number }
  | { name: 'podium' }
  /** After the podium: the setup page with the results and a photo cavalcade on top, to the finale song. */
  | { name: 'finale' };

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
  lastDeath?: { name: string; role: MafiaRole };
}

export interface EmojiAnswer {
  card: number;
  teamId: TeamId;
  correct: boolean;
}

export interface WheelState {
  /** Slot number (1..12) chosen per team. */
  picks: Record<TeamId, number>;
  /** Winning slot once spun. */
  result?: number;
  /** Total rotation in degrees for the spin animation. */
  rotation: number;
  spinning: boolean;
  spunAt?: number;
  /**
   * The staged "network error" in the middle of the spin: a fake 404 page,
   * then a link that plays the Teams video, then back to the wheel. Runs once.
   */
  prank?: 'error' | 'video' | 'done';
}

/* ---------- Deal or Drink ---------- */

export interface DealCase {
  n: number;
  value: number;
  opened: boolean;
  owner?: TeamId;
  /** Team that opened it during a round (not set for own-case reveals). */
  openedBy?: TeamId;
  openedRound?: number;
}

export interface DealOffer {
  round: number;
  points: number;
  sips: number;
  bonus?: string;
  /** The bank's short justification, shown on the TV. */
  reason?: string;
  answer?: 'deal' | 'nodeal';
}

export interface DealTeam {
  caseNo?: number;
  status: 'playing' | 'dealt';
  dealPoints?: number;
  dealSips?: number;
  dealRound?: number;
  offers: DealOffer[];
  /** Sips the team may hand out, accumulated from openings. */
  sipsOut: number;
  /** Sips each team member has had to take. */
  sipsIn: number;
  revealed: boolean;
}

export type DealStage =
  | { name: 'setup' }
  | { name: 'pick'; teamIndex: number }
  | { name: 'round'; sub: 'spotlight' | 'choose' | 'suspense' | 'reveal'; teamIndex: number; caseNo?: number }
  | { name: 'bank'; sub: 'ringing' | 'thinking' | 'comment' | 'offer' | 'answered'; teamIndex: number; final: boolean; comment?: string }
  | { name: 'reveal'; sub: 'intro' | 'open' | 'shown'; teamIndex: number }
  | { name: 'results' };

export interface DealState {
  values: number[];
  cases: DealCase[];
  teams: Record<TeamId, DealTeam>;
  round: number;
  stage: DealStage;
  alcoholFree: boolean;
  pauseUntil?: number;
}

export interface EmojiState {
  current: number;
  answers: EmojiAnswer[];
  startedAt?: number;
  revealed: boolean;
}

/** How a song in the quiz was resolved: the host pressed Tittel or Artist, or the 20 seconds ran out. */
export type SixReveal = 'title' | 'artist' | 'timeout';

export interface SixPlayed {
  /** Index into SONGS. */
  song: number;
  by: SixReveal;
}

export interface SixState {
  startedAt?: number;
  finished: boolean;
  /** Song indexes in the order they play this round; the opener is always first. */
  order?: number[];
  /** Position in `order` of the song playing now. */
  pos?: number;
  /** When the current song started, so the audio can be re-synced after a refresh. */
  songStartedAt?: number;
  /** Songs already played this round, newest last. */
  played?: SixPlayed[];
}

export interface GameState {
  version: 1;
  teams: Team[];
  events: GameEvent[];
  results: EventResult[];
  phase: Phase;
  /** Set when one event was started on its own from the setup page; its points screen returns to setup. */
  singleEvent?: string;
  /** Pending (auto-suggested) placements for the current event. */
  pending?: { placements?: Placements; loser?: TeamId; note?: string };
  six?: SixState;
  mafia?: MafiaState;
  emoji?: EmojiState;
  wheel?: WheelState;
  deal?: DealState;
  /** Undo stack for Deal or Drink (newest last). */
  dealHistory?: DealState[];
  settings: { muted: boolean; volume: number; discussSec: number };
  updatedAt: number;
}
