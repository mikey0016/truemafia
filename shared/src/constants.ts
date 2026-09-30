import type { RoleId, RoomSettings } from './roles.js';

export const DEFAULT_SETTINGS: RoomSettings = {
  gameType: 'CLASSIC',
  playerCount: 8,
  mafiaCount: 2,
  donEnabled: true,
  doctorEnabled: true,
  detectiveEnabled: true,
  bodyguardEnabled: false,
  serialKillerEnabled: false,
  jesterEnabled: false,
  discussionSeconds: 180,
  votingSeconds: 60,
  nightSeconds: 45,
  privateRoom: false,
  revealRolesOnDeath: true,
  anonymousVoting: false,
};

export const PHASE_SECONDS: Record<string, number> = {
  ROLE_REVEAL: 20,
  NIGHT: 45,
  NIGHT_RESULT: 8,
  DAY: 10,
  DISCUSSION: 180,
  VOTING: 60,
  VOTE_RESULT: 8,
  GAME_OVER: 600,
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 15;

export const PLAYER_COUNT_OPTIONS = [4, 6, 8, 10, 12, 15];

export const CHAT_MAX_LEN = 240;
export const CHAT_RATE_PER_10S = 8;

export const RATE_LIMITS = {
  auth: 10, // per minute
  createRoom: 3, // per minute
  vote: 30, // per minute
  action: 30,
  chat: 20,
};

export function suggestedRolePlan(count: number, mafiaCount: number, s: RoomSettings): RoleId[] {
  const roles: RoleId[] = [];
  const mafia = Math.max(1, Math.min(mafiaCount, Math.floor((count - 1) / 2)));
  for (let i = 0; i < mafia; i++) roles.push('MAFIA');
  if (s.donEnabled && mafia >= 2) {
    roles[0] = 'DON'; // first mafia slot becomes the Don
  }
  if (s.doctorEnabled) roles.push('DOCTOR');
  if (s.detectiveEnabled) roles.push('DETECTIVE');
  if (s.bodyguardEnabled) roles.push('BODYGUARD');
  if (s.serialKillerEnabled) roles.push('SERIAL_KILLER');
  if (s.jesterEnabled) roles.push('JESTER');
  while (roles.length < count) roles.push('CITIZEN');
  return roles.slice(0, count);
}

export function startingTeamCounts(roles: RoleId[]): {
  mafia: number;
  town: number;
  independents: number;
} {
  let mafia = 0;
  let town = 0;
  let independents = 0;
  for (const r of roles) {
    if (r === 'MAFIA' || r === 'DON') mafia++;
    else if (r === 'CITIZEN' || r === 'DOCTOR' || r === 'DETECTIVE' || r === 'BODYGUARD') town++;
    else independents++;
  }
  return { mafia, town, independents };
}
