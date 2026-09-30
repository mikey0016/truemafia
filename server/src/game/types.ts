import type {
  ChatMessage,
  GamePhase,
  GameSnapshot,
  RoleId,
  RoomSettings,
  Team,
} from '@truemafia/shared';

export interface GamePlayer {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  isBot: boolean;
  seat: number;
  role: RoleId;
  alive: boolean;
  deathRound?: number;
  deathCause?: 'NIGHT_KILL' | 'BODYGUARD' | 'VOTED';
  lastNightTarget?: number; // doctor/bodyguard anti-repeat guard
  investigations: { targetId: number; result: 'MAFIA' | 'NOT_MAFIA' }[];
  kills: number;
  votesReceived: number;
  connected: boolean;
}

export interface NightAction {
  actorId: number;
  kind: 'kill' | 'protect' | 'investigate' | 'save';
  targetId: number;
}

export interface GameEventHooks {
  onSnapshot: (snapshotByUserId: Map<number, GameSnapshot>) => void;
  onChat: (msg: ChatMessage, audience: (p: GamePlayer) => boolean) => void;
  onToast: (userId: number | null, kind: 'info' | 'success' | 'error', message: string) => void;
  onAchievement: (userId: number, id: string, name: string) => void;
  onGameOver: (winner: Team, reason: string) => void;
  onPhaseChanged: () => void; // used by bot AI + room manager persistence
}

export interface RoomLike {
  code: string;
  roomId: number | null;
  settings: RoomSettings;
  demoMode: boolean;
}

export type DeathCause = GamePlayer['deathCause'];

export interface ResolvedNight {
  deaths: { userId: number; cause: DeathCause }[];
  saved: number[];
  investigateResults: { targetId: number; result: 'MAFIA' | 'NOT_MAFIA' }[];
}

export function phaseDuration(phase: GamePhase, settings: RoomSettings): number {
  switch (phase) {
    case 'NIGHT':
      return settings.nightSeconds;
    case 'DISCUSSION':
      return settings.discussionSeconds;
    case 'VOTING':
      return settings.votingSeconds;
    default:
      return 0; // handled by engine defaults
  }
}
