import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@truemafia/shared';
import { getInitData } from './telegram';
import { BACKEND_URL } from '../config';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents & { auth: (initData: string, ack: (res: AuthResult) => void) => void }>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socket) return socket;
  socket = io(BACKEND_URL || undefined, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 4000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    socket!.emit('auth', getInitData(), (res) => {
      if (!res.ok) console.warn('[true-mafia] socket auth failed:', res.error);
    });
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
