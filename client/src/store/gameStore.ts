import { create } from 'zustand';
import type {
  ChatMessage,
  GameHistoryEntry,
  GameSnapshot,
  ProfileStats,
  PublicPlayer,
  RoomSettings,
  LeaderboardEntry,
  ShopItem,
} from '@truemafia/shared';
import type { AchievementDef } from '@truemafia/shared';
import { ACHIEVEMENTS } from '@truemafia/shared';
import { getInitData } from '../services/telegram';
import { getGuestId, getGuestName } from '../services/identity';
import { apiUrl } from '../config';

/**
 * REST so'rovlarida Telegram initData header'ini yuborish —
 * server authMiddleware shu header bo'yicha tekshiradi (x-telegram-init-data).
 * GitHub Pages'da VITE_BACKEND_URL orqali absolut backend'ga boradi,
 * local/Telegram'da esa relative (/api) ishlaydi.
 */
async function apiFetch(url: string): Promise<Response> {
  return fetch(apiUrl(url), {
    headers: {
      'x-telegram-init-data': getInitData(),
      'x-guest-id': String(getGuestId()),
      'x-guest-name': getGuestName(),
    },
  });
}

async function apiPost(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(apiUrl(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getInitData(),
      'x-guest-id': String(getGuestId()),
      'x-guest-name': getGuestName(),
    },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // empty body
  }
  return { ok: res.ok, status: res.status, json };
}

export type Screen =
  | 'home'
  | 'create'
  | 'join'
  | 'lobby'
  | 'game'
  | 'profile'
  | 'history'
  | 'leaderboard'
  | 'achievements'
  | 'settings'
  | 'market'
  | 'admin';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface OpenRoom {
  code: string;
  players: number;
  maxPlayers: number;
  phase: string;
}

interface GameState {
  // navigation
  screen: Screen;
  navStack: Screen[];
  navigate: (s: Screen) => void;
  back: () => void;
  resetTo: (s: Screen) => void;

  // socket connection + pending action (backend Cold Start kutish uchun)
  socketConnected: boolean;
  setSocketConnected: (v: boolean) => void;
  /** ulanib bo'lgach qayta bajariladigan amal (quick match / create room) */
  pendingAction: (() => void) | null;
  setPendingAction: (a: (() => void) | null) => void;

  // identity
  tgUserId: number | null;
  tgName: string;
  tgPhoto?: string;
  setIdentity: (id: number, name: string, photo?: string) => void;

  // profile
  profile: ProfileStats | null;
  profileLoading: boolean;
  profileError: string | null;
  /** true = backend yo'q, lokal demo profil ko'rsatilmoqda */
  profileOffline: boolean;
  loadProfile: () => Promise<void>;

  // room / lobby
  roomCode: string | null;
  roomPlayers: PublicPlayer[];
  roomSettings: RoomSettings | null;
  /** kim qaysi yopiq pozitsiyani (slot) olgani — rol o'zi sir saqlanadi */
  rolePicks: { userId: number; displayName: string; slot: number }[];
  /** o'zim tanlagan yopiq pozitsiya (null = tanlamagan) */
  mySlot: number | null;
  isHost: boolean;
  ready: boolean;
  setRoomState: (s: {
    room: { code: string; players: PublicPlayer[]; settings: RoomSettings; rolePicks?: { userId: number; displayName: string; slot: number }[] };
    you: { isHost: boolean; ready: boolean; slot?: number | null };
  }) => void;
  clearRoom: () => void;
  /** yopiq kartani (slot) olish yoki bo'shatish (null) */
  pickRole: (slot: number | null) => void;

  // game
  snapshot: GameSnapshot | null;
  setSnapshot: (s: GameSnapshot) => void;
  roleCardVisible: boolean;
  roleCardFlipped: boolean;
  dismissedRoleRound: number | null;
  showRoleCard: () => void;
  /** round — qaysi raund kartasi yopilgani (ROLE_REVEAL auto-show mantiqi uchun) */
  dismissRoleCard: (round?: number) => void;

  // chat
  chatMessages: ChatMessage[];
  pushChat: (m: ChatMessage) => void;
  clearChat: () => void;

  // achievements popup
  achievementPopup: AchievementDef | null;
  showAchievement: (id: string) => void;

  // toasts
  toasts: Toast[];
  pushToast: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: number) => void;

  // leaderboard
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  loadLeaderboard: (range: 'GLOBAL' | 'WEEKLY' | 'MONTHLY') => Promise<void>;

  // match history
  history: GameHistoryEntry[];
  historyLoading: boolean;
  loadHistory: () => Promise<void>;

  // market
  shopBalance: number;
  shopItems: (ShopItem & { owned: boolean })[];
  shopLoading: boolean;
  loadShop: () => Promise<void>;
  buyItem: (itemId: string) => Promise<boolean>;
  equipItem: (itemId: string) => Promise<boolean>;
  unequipItem: (kind: 'frame' | 'title') => Promise<boolean>;

  // maxsus nick (Settings)
  setNickname: (nick: string) => Promise<boolean>;

  // host: xona sozlamasini o'zgartirish (lobbyda)
  updateRoomSettings: (patch: Partial<RoomSettings>) => void;

  // admin panel
  adminStats: {
    onlinePlayers: number;
    activeGames: number;
    openRooms: number;
    totalUsers: number;
    totalGames: number;
  } | null;
  adminRooms: { code: string; phase: string; round: number; players: number; demo: boolean }[];
  adminUsers: {
    userId: number;
    username: string;
    displayName: string;
    level: number;
    coins: number;
    games: number;
    wins: number;
    reputation: number;
    isBanned: boolean;
    lastSeenAt: number;
  }[];
  adminLoading: boolean;
  loadAdminStats: () => Promise<void>;
  loadAdminRooms: () => Promise<void>;
  loadAdminUsers: (q: string) => Promise<void>;
  adminCloseRoom: (code: string) => Promise<boolean>;
  adminSetBan: (userId: number, banned: boolean) => Promise<boolean>;
  adminAddCoins: (userId: number, amount: number) => Promise<boolean>;
  adminBroadcast: (text: string) => Promise<boolean>;

  // open rooms (find a game)
  openRooms: OpenRoom[];
  openRoomsLoading: boolean;
  openRoomsError: string | null;
  loadOpenRooms: () => Promise<void>;
}

let toastSeq = 1;

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'home',
  navStack: [],
  navigate: (s) =>
    set((st) => ({ screen: s, navStack: [...st.navStack, st.screen] })),
  back: () =>
    set((st) => {
      const stack = [...st.navStack];
      const prev = stack.pop();
      return prev ? { screen: prev, navStack: stack } : {};
    }),
  resetTo: (s) => set({ screen: s, navStack: [] }),

  socketConnected: false,
  setSocketConnected: (v) => set({ socketConnected: v }),
  pendingAction: null,
  setPendingAction: (a) => set({ pendingAction: a }),
  // (pendingAction qiymati funksiya — setPendingAction bilan o'rnatiladi)

  tgUserId: null,
  tgName: 'Player',
  tgPhoto: undefined,
  setIdentity: (id, name, photo) => set({ tgUserId: id, tgName: name, tgPhoto: photo }),

  profile: null,
  profileLoading: false,
  profileError: null,
  profileOffline: false,
  loadProfile: async () => {
    set({ profileLoading: true, profileError: null });
    try {
      const res = await apiFetch('/api/me');
      if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : `HTTP ${res.status}`);
      const json = (await res.json()) as { profile: ProfileStats | null };
      if (!json.profile) throw new Error('Empty profile');
      set({ profile: json.profile, profileLoading: false, profileError: null, profileOffline: false });
    } catch (e) {
      // Backend yo'q (GitHub Pages'da VITE_BACKEND_URL bo'sh) —
      // bo'sh xato o'rniga lokal demo profil ko'rsatamiz.
      const name = getGuestName();
      set({
        profileLoading: false,
        profileError: null,
        profileOffline: true,
        profile: {
          userId: 0,
          username: name,
          displayName: name,
          photoUrl: undefined,
          level: 1,
          xp: 0,
          xpToNext: 100,
          games: 0,
          wins: 0,
          mafiaWins: 0,
          townWins: 0,
          independentWins: 0,
          winRate: 0,
          bestStreak: 0,
          currentStreak: 0,
          reputation: 0,
          coins: 0,
          achievements: [],
          isAdmin: false,
        },
      });
      void e;
    }
  },

  roomCode: null,
  roomPlayers: [],
  roomSettings: null,
  rolePicks: [],
  mySlot: null,
  isHost: false,
  ready: false,
  setRoomState: ({ room, you }) =>
    set((st) => ({
      roomCode: room.code,
      roomPlayers: room.players,
      roomSettings: room.settings,
      rolePicks: room.rolePicks ?? [],
      mySlot: you.slot ?? null,
      isHost: you.isHost,
      ready: you.ready,
      // boshqa xonaga o'tganda eski chat aralashmasin
      chatMessages: st.roomCode && st.roomCode !== room.code ? [] : st.chatMessages,
    })),
  clearRoom: () =>
    set({ roomCode: null, roomPlayers: [], roomSettings: null, rolePicks: [], mySlot: null, isHost: false, ready: false, snapshot: null, chatMessages: [], dismissedRoleRound: null }),
  pickRole: (slot) => {
    import('../services/socket').then(({ getSocket }) => {
      getSocket().emit('room:pickRole', { slot }, (res) => {
        if (!res.ok) get().pushToast('error', res.error ?? 'Tanlab bo‘lmadi');
      });
    });
  },

  snapshot: null,
  setSnapshot: (s) => set({ snapshot: s }),
  roleCardVisible: false,
  roleCardFlipped: false,
  /** nechinchi raund kartasi yopilgan (ROLE_REVEAL da qayta ochilmasligi uchun) */
  dismissedRoleRound: null as number | null,
  showRoleCard: () => set({ roleCardVisible: true, roleCardFlipped: false }),
  dismissRoleCard: (round?: number) =>
    set({ roleCardVisible: false, dismissedRoleRound: round ?? null }),

  chatMessages: [],
  pushChat: (m) => set((st) => ({ chatMessages: [...st.chatMessages.slice(-150), m] })),
  clearChat: () => set({ chatMessages: [] }),

  achievementPopup: null,
  showAchievement: (id) => {
    const def = ACHIEVEMENTS.find((a) => a.id === id) ?? null;
    set({ achievementPopup: def });
  },

  toasts: [],
  pushToast: (kind, message) => {
    const id = toastSeq++;
    set((st) => ({ toasts: [...st.toasts.slice(-3), { id, kind, message }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  leaderboard: [],
  leaderboardLoading: false,
  loadLeaderboard: async (range) => {
    set({ leaderboardLoading: true });
    try {
      const res = await apiFetch(`/api/leaderboard?range=${range}`);
      const json = (await res.json()) as { entries: LeaderboardEntry[] };
      set({ leaderboard: json.entries ?? [], leaderboardLoading: false });
    } catch {
      set({ leaderboardLoading: false });
    }
  },

  history: [],
  historyLoading: false,
  loadHistory: async () => {
    set({ historyLoading: true });
    try {
      const res = await apiFetch('/api/history');
      const json = (await res.json()) as { history: GameHistoryEntry[] };
      set({ history: json.history ?? [], historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },

  openRooms: [],
  openRoomsLoading: false,
  openRoomsError: null,
  loadOpenRooms: async () => {
    set({ openRoomsLoading: true, openRoomsError: null });
    try {
      const res = await apiFetch('/api/rooms');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rooms: OpenRoom[] };
      set({ openRooms: json.rooms ?? [], openRoomsLoading: false });
    } catch (e) {
      set({
        openRoomsLoading: false,
        openRoomsError: e instanceof Error ? e.message : 'Tarmoq xatosi',
      });
    }
  },

  shopBalance: 0,
  shopItems: [],
  shopLoading: false,
  loadShop: async () => {
    set({ shopLoading: true });
    try {
      const res = await apiFetch('/api/shop');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { balance: number; items: (ShopItem & { owned: boolean })[] };
      set({ shopBalance: json.balance ?? 0, shopItems: json.items ?? [], shopLoading: false });
    } catch {
      set({ shopLoading: false });
    }
  },
  buyItem: async (itemId) => {
    const { ok, json } = await apiPost('/api/shop/buy', { item_id: itemId });
    if (!ok) {
      get().pushToast('error', (json.error as string) ?? 'Olinmadi');
      return false;
    }
    if (typeof json.balance === 'number') set({ shopBalance: json.balance });
    get().pushToast('success', 'Sotib olindi!');
    void get().loadShop();
    void get().loadProfile();
    return true;
  },
  equipItem: async (itemId) => {
    const { ok, json } = await apiPost('/api/shop/equip', { item_id: itemId });
    if (!ok) {
      get().pushToast('error', (json.error as string) ?? 'Kiyib bo‘lmadi');
      return false;
    }
    get().pushToast('success', 'Kiyildi!');
    void get().loadProfile();
    return true;
  },
  unequipItem: async (kind) => {
    const { ok } = await apiPost('/api/shop/unequip', { kind });
    if (!ok) return false;
    void get().loadProfile();
    return true;
  },

  setNickname: async (nick) => {
    const { ok, json } = await apiPost('/api/profile/nick', { nick });
    if (!ok) {
      get().pushToast('error', (json.error as string) ?? 'Saqlanmadi');
      return false;
    }
    get().pushToast('success', 'Nick saqlandi!');
    void get().loadProfile();
    return true;
  },

  updateRoomSettings: (patch) => {
    import('../services/socket').then(({ getSocket }) => {
      getSocket().emit('room:updateSettings', { settings: patch }, (res) => {
        if (!res.ok) get().pushToast('error', res.error ?? 'O‘zgartirilmadi');
      });
    });
  },

  adminStats: null,
  adminRooms: [],
  adminUsers: [],
  adminLoading: false,
  loadAdminStats: async () => {
    set({ adminLoading: true });
    try {
      const res = await apiFetch('/api/admin/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NonNullable<GameState['adminStats']>;
      set({ adminStats: json, adminLoading: false });
    } catch {
      set({ adminLoading: false });
    }
  },
  loadAdminRooms: async () => {
    set({ adminLoading: true });
    try {
      const res = await apiFetch('/api/admin/rooms');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rooms: GameState['adminRooms'] };
      set({ adminRooms: json.rooms ?? [], adminLoading: false });
    } catch {
      set({ adminLoading: false });
    }
  },
  loadAdminUsers: async (q) => {
    set({ adminLoading: true });
    try {
      const res = await apiFetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { users: GameState['adminUsers'] };
      set({ adminUsers: json.users ?? [], adminLoading: false });
    } catch {
      set({ adminLoading: false });
    }
  },
  adminCloseRoom: async (code) => {
    const { ok, json } = await apiPost(`/api/admin/rooms/${code}/close`, {});
    if (!ok) get().pushToast('error', (json.error as string) ?? 'Yopilmadi');
    else void get().loadAdminRooms();
    return ok;
  },
  adminSetBan: async (userId, banned) => {
    const { ok, json } = await apiPost(`/api/admin/${banned ? 'ban' : 'unban'}/${userId}`, {});
    if (!ok) get().pushToast('error', (json.error as string) ?? 'Bajarilmadi');
    else void get().loadAdminUsers('');
    return ok;
  },
  adminAddCoins: async (userId, amount) => {
    const { ok, json } = await apiPost(`/api/admin/coins/${userId}`, { amount });
    if (!ok) {
      get().pushToast('error', (json.error as string) ?? 'Bajarilmadi');
      return false;
    }
    get().pushToast('success', `Coin o‘zgardi: ${json.balance ?? '?'}`);
    void get().loadAdminUsers('');
    return true;
  },
  adminBroadcast: async (text) => {
    const { ok, json } = await apiPost('/api/admin/broadcast', { text });
    if (!ok) {
      get().pushToast('error', (json.error as string) ?? 'Yuborilmadi');
      return false;
    }
    get().pushToast('success', 'E’lon yuborildi!');
    return true;
  },
}));
