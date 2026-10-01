import type { RoleId, RoomSettings } from './roles.js';

/** Ilova versiyasi — client (Home/Settings) va server (/api/health) shu yerdan o'qiydi. */
export const APP_VERSION = 'v2.0.1';

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
  botCount: 0,
  roleDraft: false,
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

/** Marketda sotiladigan buyumlar: premium rollar, avatar ramkalari, unvonlar. */
export type ShopKind = 'role' | 'frame' | 'title';

export interface ShopItem {
  id: string;
  kind: ShopKind;
  price: number;
  /** kind === 'role' uchun */
  roleId?: RoleId;
  /** kind === 'frame' | 'title' uchun: ramka kaliti yoki unvon matni */
  value?: string;
  name: string;
  desc?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // --- premium rollar (faqat Rol tanlash rejimida tanlanadi) ---
  { id: 'role_bodyguard', kind: 'role', roleId: 'BODYGUARD', price: 150, name: 'Tansoqchi roli', desc: 'O‘q oldida turadigan himoyachi' },
  { id: 'role_jester', kind: 'role', roleId: 'JESTER', price: 200, name: 'Masxaraboz roli', desc: 'Ovoz bilan chiqarilsangiz yutasiz' },
  { id: 'role_don', kind: 'role', roleId: 'DON', price: 300, name: 'Don roli', desc: 'Oilaning boshlig‘i — yakuniy qaror sizniki' },
  { id: 'role_serial_killer', kind: 'role', roleId: 'SERIAL_KILLER', price: 400, name: 'Seriyali qotil roli', desc: 'Yolg‘iz bo‘ri — oxirgi tirik qolgan yutadi' },
  // --- avatar ramkalari (profil va lobbida ko‘rinadi) ---
  { id: 'frame_bronze', kind: 'frame', price: 80, value: 'bronze', name: 'Bronza ramka', desc: 'Boshlang‘ich jangchi belgisi' },
  { id: 'frame_neon', kind: 'frame', price: 180, value: 'neon', name: 'Neon ramka', desc: 'Tunda yonib turadigan chiziq' },
  { id: 'frame_gold', kind: 'frame', price: 350, value: 'gold', name: 'Oltin ramka', desc: 'Faqat donlar taqqan hurmat' },
  // --- unvonlar (ism yonida ko‘rinadi) ---
  { id: 'title_alibi', kind: 'title', price: 100, value: 'Alibiy', name: '«Alibiy» unvoni', desc: 'Hech kim ishonolmaydi, sizga ishonadi' },
  { id: 'title_ghost', kind: 'title', price: 150, value: 'Arvoh', name: '«Arvoh» unvoni', desc: 'Nariqdan kuzatishni yaxshi ko‘rasiz' },
  { id: 'title_baron', kind: 'title', price: 250, value: 'Baron', name: '«Baron» unvoni', desc: 'Shahar tunlari sizning jebelingizda' },
];

export function shopItemForRole(roleId: RoleId): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.kind === 'role' && i.roleId === roleId);
}

export function isPremiumRole(roleId: RoleId): boolean {
  return shopItemForRole(roleId) !== undefined;
}
