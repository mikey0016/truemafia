export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'NIGHT'
  | 'NIGHT_RESULT'
  | 'DAY'
  | 'DISCUSSION'
  | 'VOTING'
  | 'VOTE_RESULT'
  | 'GAME_OVER';

export type Team = 'TOWN' | 'MAFIA' | 'INDEPENDENT';

export type RoleId =
  | 'CITIZEN'
  | 'MAFIA'
  | 'DON'
  | 'DOCTOR'
  | 'DETECTIVE'
  | 'BODYGUARD'
  | 'SERIAL_KILLER'
  | 'JESTER';

export interface RoleDefinition {
  id: RoleId;
  name: string;
  team: Team;
  icon: string;
  tagline: string;
  description: string;
  ability: string;
  color: string;
  nightAction: boolean;
  /** which night-action "slot" this role fills; mafia/don share 'mafia' */
  actionKind?: 'kill' | 'protect' | 'investigate' | 'save';
}

export const ROLES: Record<RoleId, RoleDefinition> = {
  CITIZEN: {
    id: 'CITIZEN',
    name: 'Citizen',
    team: 'TOWN',
    icon: 'user',
    tagline: 'FIND THE MAFIA',
    description: 'An honest resident of the town.',
    ability: 'Discuss and vote to eliminate the Mafia.',
    color: '#8ea0b5',
    nightAction: false,
  },
  MAFIA: {
    id: 'MAFIA',
    name: 'Mafia',
    team: 'MAFIA',
    icon: 'skull',
    tagline: 'ELIMINATE THE TOWN',
    description: 'A member of the criminal underworld.',
    ability: 'Each night, choose one player to eliminate.',
    color: '#e5484d',
    nightAction: true,
    actionKind: 'kill',
  },
  DON: {
    id: 'DON',
    name: 'Don',
    team: 'MAFIA',
    icon: 'crown',
    tagline: 'LEAD THE FAMILY',
    description: 'The boss of the Mafia family.',
    ability: 'Leads the Mafia and casts the final kill decision each night.',
    color: '#f5a524',
    nightAction: true,
    actionKind: 'kill',
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'Doctor',
    team: 'TOWN',
    icon: 'plus',
    tagline: 'KEEP THEM BREATHING',
    description: 'A surgeon with steady hands.',
    ability: 'Each night, protect one player from elimination.',
    color: '#46a758',
    nightAction: true,
    actionKind: 'protect',
  },
  DETECTIVE: {
    id: 'DETECTIVE',
    name: 'Detective',
    team: 'TOWN',
    icon: 'search',
    tagline: 'KNOW THE TRUTH',
    description: 'A sharp-eyed investigator.',
    ability: 'Each night, investigate one player: MAFIA or NOT MAFIA.',
    color: '#0091ff',
    nightAction: true,
    actionKind: 'investigate',
  },
  BODYGUARD: {
    id: 'BODYGUARD',
    name: 'Bodyguard',
    team: 'TOWN',
    icon: 'shield',
    tagline: 'STAND IN THE LINE OF FIRE',
    description: 'A loyal protector who takes the bullet.',
    ability:
      'Each night, guard one player. If they are attacked, the Bodyguard dies instead.',
    color: '#b083f0',
    nightAction: true,
    actionKind: 'save',
  },
  SERIAL_KILLER: {
    id: 'SERIAL_KILLER',
    name: 'Serial Killer',
    team: 'INDEPENDENT',
    icon: 'knife',
    tagline: 'LAST ONE BREATHING',
    description: 'A lone psychopath with a personal agenda.',
    ability: 'Each night, kill one player. Wins alone as the last survivor.',
    color: '#ff6b35',
    nightAction: true,
    actionKind: 'kill',
  },
  JESTER: {
    id: 'JESTER',
    name: 'Jester',
    team: 'INDEPENDENT',
    icon: 'masks',
    tagline: 'TRICK THEM ALL',
    description: 'A chaos agent hiding among the innocent.',
    ability: 'Wins instantly if voted out during the day.',
    color: '#ec4899',
    nightAction: false,
  },
};

export interface RoomSettings {
  gameType: 'CLASSIC' | 'ADVANCED' | 'CUSTOM';
  playerCount: number;
  mafiaCount: number;
  donEnabled: boolean;
  doctorEnabled: boolean;
  detectiveEnabled: boolean;
  bodyguardEnabled: boolean;
  serialKillerEnabled: boolean;
  jesterEnabled: boolean;
  discussionSeconds: number;
  votingSeconds: number;
  nightSeconds: number;
  privateRoom: boolean;
  revealRolesOnDeath: boolean;
  anonymousVoting: boolean;
}

export interface PublicPlayer {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  seat: number;
}

export interface PlayerCardView {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  seat: number;
  alive: boolean;
  connected: boolean;
  isBot: boolean;
  /** your own role, or revealed roles (on death when setting enabled) */
  role?: RoleId;
  /** true when you and target share a night chat channel (mafia) */
  ally?: boolean;
}

export interface ChatMessage {
  id: string;
  channel: 'day' | 'mafia' | 'ghosts';
  senderId: number; // 0 = system
  senderName: string;
  photoUrl?: string;
  text: string;
  at: number;
}

export interface PhaseInfo {
  phase: GamePhase;
  round: number;
  endsAt: number | null; // server epoch ms
  secondsLeft: number;
}

export interface GameSnapshot {
  roomId: string;
  roomCode: string;
  phase: PhaseInfo;
  you: {
    userId: number;
    alive: boolean;
    role: RoleId | null;
    hasActed: boolean;
    investigations: { targetId: number; result: 'MAFIA' | 'NOT_MAFIA' }[];
  };
  players: PlayerCardView[];
  chat: ChatMessage[];
  channels: ('day' | 'mafia' | 'ghosts')[];
  canVote: boolean;
  myVote?: number | null;
  voteCounts?: Record<string, number>;
  settings: RoomSettings;
  winner: Team | null;
}

export interface ProfileStats {
  userId: number;
  username: string;
  photoUrl?: string;
  level: number;
  xp: number;
  xpToNext: number;
  games: number;
  wins: number;
  mafiaWins: number;
  townWins: number;
  independentWins: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  reputation: number;
  coins: number;
  achievements: { id: string; unlockedAt: number }[];
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  photoUrl?: string;
  wins: number;
  games: number;
  rating: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rare?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'FIRST_BLOOD', name: 'First Blood', description: 'Win your first game.', icon: 'drop' },
  { id: 'SHADOW', name: 'Shadow', description: 'Win 5 Mafia games.', icon: 'skull' },
  {
    id: 'DETECTIVE',
    name: 'Detective',
    description: 'Successfully identify Mafia 10 times.',
    icon: 'search',
  },
  { id: 'SURVIVOR', name: 'Survivor', description: 'Survive 10 games.', icon: 'shield' },
  {
    id: 'LAST_STANDING',
    name: 'Last Standing',
    description: 'Be the final surviving player of a win.',
    icon: 'crown',
    rare: true,
  },
  { id: 'VETERAN', name: 'Veteran', description: 'Play 25 games.', icon: 'user' },
];
