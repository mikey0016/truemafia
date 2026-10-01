import { create } from 'zustand';
import type {
  ChatMessage,
  GameHistoryEntry,
  GameSnapshot,
  ProfileStats,
  PublicPlayer,
  RoleId,
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
  /** kim karta tanlagani (qaysi karta — sir, o'ziniki myPick'da) */
  rolePicks: { userId: number; displayName: string }[];
  myPick: RoleId | null;
  isHost: boolean;
  ready: boolean;
  setRoomState: (s: {
    room: { code: string; players: PublicPlayer[]; settings: RoomSettings; rolePicks?: { userId: number; displayName: string }[] };
    you: { isHost: boolean; ready: boolean; pick?: RoleId | null };
  }) => void;
  clearRoom: () => void;
  pickRole: (roleId: RoleId | null) => void;

  // game
  snapshot: GameSnapshot | null;
  setSnapshot: (s: GameSnapshot) => void;
  roleCardVisible: boolean;
  roleCardFlipped: boolean;
  showRoleCard: () => void;
  dismissRoleCard: () => void;

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
        },
      });
      void e;
    }
  },

  roomCode: null,
  roomPlayers: [],
  roomSettings: null,
  rolePicks: [],
  myPick: null,
  isHost: false,
  ready: false,
  setRoomState: ({ room, you }) =>
    set({
      roomCode: room.code,
      roomPlayers: room.players,
      roomSettings: room.settings,
      rolePicks: room.rolePicks ?? [],
      myPick: you.pick ?? null,
      isHost: you.isHost,
      ready: you.ready,
    }),
  clearRoom: () =>
    set({ roomCode: null, roomPlayers: [], roomSettings: null, rolePicks: [], myPick: null, isHost: false, ready: false, snapshot: null }),
  pickRole: (roleId) => {
    import('../services/socket').then(({ getSocket }) => {
      getSocket().emit('room:pickRole', { roleId }, (res) => {
        if (!res.ok) get().pushToast('error', res.error ?? 'Tanlab bo‘lmadi');
      });
    });
  },

  snapshot: null,
  setSnapshot: (s) => set({ snapshot: s }),
  roleCardVisible: false,
  roleCardFlipped: false,
  showRoleCard: () => set({ roleCardVisible: true, roleCardFlipped: false }),
  dismissRoleCard: () => set({ roleCardVisible: false }),

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
    try {
      const res = await fetch(apiUrl('/api/shop/buy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': getInitData(),
          'x-guest-id': String(getGuestId()),
          'x-guest-name': getGuestName(),
        },
        body: JSON.stringify({ item_id: itemId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; balance?: number };
      if (!res.ok || !json.ok) {
        get().pushToast('error', json.error ?? 'Olinmadi');
        return false;
      }
      if (typeof json.balance === 'number') set({ shopBalance: json.balance });
      get().pushToast('success', 'Sotib olindi!');
      void get().loadShop();
      void get().loadProfile();
      return true;
    } catch {
      get().pushToast('error', 'Tarmoq xatosi');
      return false;
    }
  },
}));
