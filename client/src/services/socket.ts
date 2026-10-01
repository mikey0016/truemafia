import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@truemafia/shared';
import { getInitData } from './telegram';
import { getBackendUrl } from '../config';
import { getGuestId, getIdentity } from './identity';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export interface AuthPayload {
  initData: string;
  guestId?: number;
  guestName?: string;
}

type AppSocket = Socket<
  ServerToClientEvents,
  Omit<ClientToServerEvents, never> & { auth: (payload: AuthPayload, ack: (res: AuthResult) => void) => void }
>;

let socket: AppSocket | null = null;
let lastAuthOk: boolean | null = null;

function sendAuth(): void {
  if (!socket) return;
  const me = getIdentity();
  // guestId faqat manfiy bo'lganda yuboriladi — Telegram user id (musbat)
  // guest sifatida yuborilsa server rad etadi.
  const guestId = me.id !== null && me.id < 0 ? me.id : getGuestId();
  socket.emit(
    'auth',
    { initData: getInitData(), guestId, guestName: me.name },
    (res) => {
      lastAuthOk = res.ok;
      if (!res.ok) {
        // Sababini UI'da ko'rsatamiz — "Authenticate first" topishmoq bo'lmasligi uchun
        import('../store/gameStore').then(({ useGameStore }) => {
          useGameStore.getState().pushToast('error', `Auth: ${res.error ?? 'failed'}`);
        });
        console.warn('[true-mafia] socket auth failed:', res.error);
      }
    },
  );
}

export function isAuthed(): boolean | null {
  return lastAuthOk;
}

/** UNAUTHENTICATED xatoda qayta urinish uchun. */
export function reauth(): void {
  lastAuthOk = null;
  sendAuth();
}

export function getSocket(): AppSocket {
  if (socket) return socket;
  const url = getBackendUrl();
  socket = io(url || undefined, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 4000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    lastAuthOk = null;
    import('../store/gameStore').then(({ useGameStore }) => {
      useGameStore.getState().setSocketConnected(true);
    });
    sendAuth();
  });

  socket.on('disconnect', () => {
    import('../store/gameStore').then(({ useGameStore }) => {
      useGameStore.getState().setSocketConnected(false);
    });
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
