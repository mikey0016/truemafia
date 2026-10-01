import { create } from 'zustand';
import type {
  ChatMessage,
  GameHistoryEntry,
  GameSnapshot,
  ProfileStats,
  PublicPlayer,
  RoomSettings,
  LeaderboardEntry,
} from '@truemafia/shared';
import type { AchievementDef } from '@truemafia/shared';
import { ACHIEVEMENTS } from '@truemafia/shared';
import { getInitData } from '../services/telegram';
import { apiUrl } from '../config';

/**
 * REST so'rovlarida Telegram initData header'ini yuborish —
 * server authMiddleware shu header bo'yicha tekshiradi (x-telegram-init-data).
 * GitHub Pages'da VITE_BACKEND_URL orqali absolut backend'ga boradi,
 * local/Telegram'da esa relative (/api) ishlaydi.
 */
async function apiFetch(url: string): Promise<Response> {
  return fetch(apiUrl(url), { headers: { 'x-telegram-init-data': getInitData() } });
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

  // identity
  tgUserId: number | null;
  tgName: string;
  tgPhoto?: string;
  setIdentity: (id: number, name: string, photo?: string) => void;

  // profile
  profile: ProfileStats | null;
  profileLoading: boolean;
  profileError: string | null;
  loadProfile: () => Promise<void>;

  // room / lobby
  roomCode: string | null;
  roomPlayers: PublicPlayer[];
  roomSettings: RoomSettings | null;
  isHost: boolean;
  ready: boolean;
  setRoomState: (s: {
    room: { code: string; players: PublicPlayer[]; settings: RoomSettings };
    you: { isHost: boolean; ready: boolean };
  }) => void;
  clearRoom: () => void;

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

  tgUserId: null,
  tgName: 'Player',
  tgPhoto: undefined,
  setIdentity: (id, name, photo) => set({ tgUserId: id, tgName: name, tgPhoto: photo }),

  profile: null,
  profileLoading: false,
  profileError: null,
  loadProfile: async () => {
    set({ profileLoading: true, profileError: null });
    try {
      const res = await apiFetch('/api/me');
      if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : `HTTP ${res.status}`);
      const json = (await res.json()) as { profile: ProfileStats | null };
      if (!json.profile) throw new Error('Empty profile');
      set({ profile: json.profile, profileLoading: false, profileError: null });
    } catch (e) {
      set({
        profileLoading: false,
        profileError: e instanceof Error ? e.message : 'Network error',
      });
    }
  },

  roomCode: null,
  roomPlayers: [],
  roomSettings: null,
  isHost: false,
  ready: false,
  setRoomState: ({ room, you }) =>
    set({
      roomCode: room.code,
      roomPlayers: room.players,
      roomSettings: room.settings,
      isHost: you.isHost,
      ready: you.ready,
    }),
  clearRoom: () =>
    set({ roomCode: null, roomPlayers: [], roomSettings: null, isHost: false, ready: false, snapshot: null }),

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
        openRoomsError: e instanceof Error ? e.message : 'Network error',
      });
    }
  },
}));
