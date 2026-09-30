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
  loadProfile: async () => {
    set({ profileLoading: true });
    try {
      const res = await fetch('/api/me');
      const json = (await res.json()) as { profile: ProfileStats | null };
      set({ profile: json.profile, profileLoading: false });
    } catch {
      set({ profileLoading: false });
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
      const res = await fetch(`/api/leaderboard?range=${range}`);
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
      const res = await fetch('/api/history');
      const json = (await res.json()) as { history: GameHistoryEntry[] };
      set({ history: json.history ?? [], historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },
}));
