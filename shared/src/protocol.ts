import type {
  ChatMessage,
  GamePhase,
  GameSnapshot,
  LeaderboardEntry,
  ProfileStats,
  PublicPlayer,
  RoleId,
  RoomSettings,
  Team,
} from './roles.js';

export type GameType = RoomSettings['gameType'];

export interface UserRecord {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  level: number;
  xp: number;
  wins: number;
  games: number;
}

export interface CreateRoomPayload {
  settings: Partial<RoomSettings>;
  demoBots?: number;
}

export interface JoinRoomPayload {
  code: string;
}

export interface VotePayload {
  targetId: number;
}

export interface ActionPayload {
  targetId: number;
}

export interface ChatSendPayload {
  channel: 'day' | 'mafia' | 'ghosts';
  text: string;
}

export interface ServerToClientEvents {
  'room:state': (payload: {
    room: {
      code: string;
      phase: GamePhase;
      players: PublicPlayer[];
      settings: RoomSettings;
      hostId: number;
    };
    you: { isHost: boolean; ready: boolean };
  }) => void;
  'room:error': (payload: { code: string; message: string }) => void;
  'game:snapshot': (payload: GameSnapshot) => void;
  'game:toast': (payload: { kind: 'info' | 'success' | 'error'; message: string }) => void;
  'game:phase': (payload: { phase: GamePhase; round: number }) => void;
  'game:over': (payload: GameSnapshot) => void;
  'game:achievement': (payload: { id: string; name: string }) => void;
  'chat:message': (payload: ChatMessage) => void;
  'typing': (payload: { channel: string; userId: number; name: string }) => void;
  /** emitted after game results are persisted; client should reload its profile */
  'profile:updated': (payload: Record<string, never>) => void;
  /** server closed the room (empty / cleanup) — client should return home */
  'room:closed': (payload: { reason: string }) => void;
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (res: AckResult) => void) => void;
  'room:quick': (payload: Record<string, never>, ack: (res: AckResult) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: AckResult) => void) => void;
  'room:leave': (payload: Record<string, never>, ack: (res: AckResult) => void) => void;
  'room:ready': (payload: { ready: boolean }, ack: (res: AckResult) => void) => void;
  'room:start': (payload: { addBots?: number }, ack: (res: AckResult) => void) => void;
  'game:action': (payload: ActionPayload, ack: (res: AckResult) => void) => void;
  'game:vote': (payload: VotePayload, ack: (res: AckResult) => void) => void;
  'game:continue': (payload: Record<string, never>, ack: (res: AckResult) => void) => void;
  'chat:send': (payload: ChatSendPayload, ack: (res: AckResult) => void) => void;
  'chat:typing': (payload: { channel: 'day' | 'mafia' | 'ghosts' }) => void;
}

export interface AckResult {
  ok: boolean;
  error?: string;
  data?: {
    roomCode?: string;
    profile?: ProfileStats;
    leaderboard?: LeaderboardEntry[];
    achievements?: typeof import('./roles.js').ACHIEVEMENTS;
    admin?: unknown;
  };
}

export type VoteTally = Record<number, number>;

/** One finished game from the requesting player's perspective. */
export interface GameHistoryEntry {
  gameId: number;
  finishedAt: number;
  winner: Team | null;
  rounds: number;
  role: RoleId;
  alive: boolean;
  won: boolean;
}

export interface NightOutcome {
  killedIds: number[];
  savedIds: number[];
  investigateResults: { targetId: number; result: 'MAFIA' | 'NOT_MAFIA' }[];
  bodyguardDied: boolean;
}

export interface WinnerInfo {
  team: Team;
  reason: string;
}

export interface RoleCounts {
  mafia: number;
  town: number;
  independents: number;
}

export type { GamePhase, RoleId, Team, GameSnapshot, ProfileStats, LeaderboardEntry, PublicPlayer, RoomSettings, ChatMessage };
