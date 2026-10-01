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
    const me = getIdentity();
    socket!.emit(
      'auth',
      { initData: getInitData(), guestId: me.id ?? getGuestId(), guestName: me.name },
      (res) => {
        if (!res.ok) console.warn('[true-mafia] socket auth failed:', res.error);
      },
    );
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
