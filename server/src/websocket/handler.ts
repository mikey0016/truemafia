import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import type { ChatMessage, GameSnapshot, RoomSettings, Team } from '@truemafia/shared';
import { ACHIEVEMENTS, CHAT_MAX_LEN, RATE_LIMITS } from '@truemafia/shared';
import {
  guestUser,
  logAuthFailure,
  parseInitDataInsecure,
  validateInitDataDetailed,
} from '../auth/telegram.js';
import { setRoomCloseNotifier } from '../game/roomManager.js';
import type { RoomManager } from '../game/roomManager.js';
import { BotController } from '../game/bots.js';
import type { GameEngine } from '../game/engine.js';
import type { GamePlayer } from '../game/types.js';
import type { UserService } from '../services/userService.js';
import type { GameRecorder } from '../services/gameRecorder.js';
import { RateLimiter } from '../middleware/rateLimit.js';

interface SocketData {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
  roomCode?: string;
}

type AppSocket = Socket & { data: SocketData };

interface Deps {
  roomManager: RoomManager;
  users: UserService;
  recorder: GameRecorder;
  botControllers: Map<string, BotController>;
}

interface EngineHooks {
  onSnapshot: (map: Map<number, GameSnapshot>) => void;
  onChat: (msg: ChatMessage, audience: (p: import('../game/types.js').GamePlayer) => boolean) => void;
  onToast: (userId: number | null, kind: 'info' | 'success' | 'error', message: string) => void;
  onAchievement: (userId: number, id: string, name: string) => void;
  onGameOver: (winner: Team, reason: string) => void;
  onPhaseChanged: () => void;
}

export function createSocketServer(httpServer: HttpServer, deps: Deps): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e5,
  });
  const limiter = new RateLimiter();
  const bridged = new Set<string>();

  // Xona yopilganda qolgan mijozlarga 'room:closed' yuborish uchun
  setRoomCloseNotifier({
    emitToSocket: (socketId, event, payload) => io.to(socketId).emit(event, payload as never),
  });

  function bridgeEngine(engine: GameEngine): void {
    const roomCode = engine.code.toUpperCase();
    if (bridged.has(roomCode)) return;
    bridged.add(roomCode);

    const hooks: EngineHooks = {
      onSnapshot: (map: Map<number, GameSnapshot>) => {
        for (const [userId, snap] of map) {
          io.to(`user:${userId}`).emit('game:snapshot', snap);
          if (snap.phase.phase === 'GAME_OVER') io.to(`user:${userId}`).emit('game:over', snap);
        }
      },
      onChat: (msg: ChatMessage, audience: (p: GamePlayer) => boolean) => {
        const room = deps.roomManager.get(roomCode);
        if (!room) return;
        for (const p of room.engine.players) {
          if (p.isBot) continue;
          if (audience(p)) io.to(`user:${p.userId}`).emit('chat:message', msg);
        }
      },
      onToast: (userId: number | null, kind, message) => {
        if (userId === null) io.to(`room:${roomCode}`).emit('game:toast', { kind, message });
        else io.to(`user:${userId}`).emit('game:toast', { kind, message });
      },
      onAchievement: (userId: number, id: string, name: string) => {
        io.to(`user:${userId}`).emit('game:achievement', { id, name });
      },
      onGameOver: (winner: Team, reason: string) => {
        io.to(`room:${roomCode}`).emit('game:toast', {
          kind: 'info',
          message: `${winner} wins — ${reason}`,
        });
        // persist results + progression, then surface freshly unlocked achievements
        void deps.recorder
          .recordFinishedGame(engine, winner, reason)
          .then((unlocks) => {
            for (const u of unlocks) {
              const name = ACHIEVEMENTS.find((a) => a.id === u.id)?.name ?? u.id;
              io.to(`user:${u.userId}`).emit('game:achievement', { id: u.id, name });
            }
            // results are now durable — clients can safely reload profile/history
            for (const p of engine.players) {
              if (!p.isBot) io.to(`user:${p.userId}`).emit('profile:updated', {});
            }
          })
          .catch((err) => console.error('[handler] recordFinishedGame failed:', err));
      },
      onPhaseChanged: () => {
        const room = deps.roomManager.get(roomCode);
        if (room) deps.botControllers.get(roomCode)?.schedulePhaseActions();
      },
    };

    (engine as unknown as { hooks: EngineHooks }).hooks = hooks;
  }

  io.on('connection', (socket: AppSocket) => {
    let authed = false;

    socket.on(
      'auth',
      (
        payload: string | { initData?: string; guestId?: number; guestName?: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        const initData = typeof payload === 'string' ? payload : payload?.initData || '';
        const botToken = process.env.BOT_TOKEN || '';
        const result = botToken ? validateInitDataDetailed(initData, botToken) : { user: null };
        let u = result.user;
        let failReason = '';
        if (!u) {
          failReason = result.failure || (botToken ? 'unknown' : 'no server token');
        }
        if (!u && process.env.DEV_SKIP_AUTH === '1' && process.env.NODE_ENV !== 'production') {
          u = parseInitDataInsecure(initData) || {
            userId: 1,
            username: 'devuser',
            displayName: 'Dev User',
            authDate: Date.now(),
          };
        }
        if (!u && typeof payload === 'object' && payload) {
          // Mehmon rejimi: manfiy id (real Telegram id'lar musbat).
          const gid = payload.guestId;
          if (typeof gid === 'number' && Number.isSafeInteger(gid) && gid < 0 && gid > -1e12) {
            const gname = String(payload.guestName || '').slice(0, 24) || `Guest${-gid % 10000}`;
            u = guestUser(gid, gname);
            if (failReason) logAuthFailure('WS', `${failReason} -> guest`);
          } else {
            failReason += (failReason ? '+' : '') + 'no guest id';
          }
        }
        if (!u) {
          logAuthFailure('WS', failReason || 'unknown');
          ack?.({ ok: false, error: `Invalid auth (${failReason || 'unknown'})` });
          return;
        }
        socket.data.userId = u.userId;
        socket.data.username = u.username;
        socket.data.displayName = u.displayName;
        socket.data.photoUrl = u.photoUrl;
        authed = true;
        socket.join(`user:${u.userId}`);
        ack?.({ ok: true });
      },
    );

    const requireAuth = (): boolean => {
      if (authed) return true;
      socket.emit('room:error', { code: 'UNAUTHENTICATED', message: 'Authenticate first' });
      return false;
    };

    const me = (): SocketData => socket.data as SocketData;

    const findMyRoom = (): ReturnType<RoomManager['get']> => {
      const code = me().roomCode;
      return code ? deps.roomManager.get(code) : undefined;
    };

    const joinRoomSocket = (code: string): void => {
      const room = deps.roomManager.get(code)!;
      bridgeEngine(room.engine);
      if (!deps.botControllers.has(room.engine.code)) {
        deps.botControllers.set(room.engine.code, new BotController(room.engine));
      }
      deps.roomManager.attachSocket(code, me().userId, socket.id);
      socket.join(`room:${code}`);
      socket.data.roomCode = code;
      room.engine.broadcastSnapshot();
      emitRoomState(room);
    };

    socket.on('room:create', async (payload, ack) => {
      if (!requireAuth()) return;
      if (!limiter.check(`create:${me().userId}`, RATE_LIMITS.createRoom)) {
        ack?.({ ok: false, error: 'Slow down' });
        return;
      }
      const settings = sanitizeSettings(payload?.settings);
      // Botlar: settings.botCount (prod'da ham ishlaydi) + dev-only demoBots
      const settingsBots = clampInt(settings.botCount ?? 0, 0, 14, 0);
      const demoBots = clampInt(payload?.demoBots ?? 0, 0, 14, 0);
      if (demoBots > 0 && !isDemoAllowed()) {
        ack?.({ ok: false, error: 'Demo mode disabled' });
        return;
      }
      const totalBots = Math.min(14, settingsBots + demoBots);
      const res = await deps.roomManager.createRoom(
        {
          userId: me().userId,
          username: me().username,
          displayName: me().displayName,
          photoUrl: me().photoUrl,
        },
        { ...settings, botCount: settingsBots },
        totalBots,
        noopHooks(),
      );
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      if (totalBots > 0) {
        const room = deps.roomManager.get(res.code)!;
        deps.botControllers.set(res.code, new BotController(room.engine));
        deps.botControllers.get(res.code)!.addBots(totalBots);
      }
      joinRoomSocket(res.code);
      ack?.({ ok: true, data: { roomCode: res.code } });
    });

    socket.on('room:quick', (_p: unknown, ack) => {
      if (!requireAuth()) return;
      const res = deps.roomManager.quickJoin({ ...me() });
      if (!res.ok || !res.code) {
        ack?.({ ok: false, error: res.error ?? 'No rooms' });
        return;
      }
      joinRoomSocket(res.code);
      ack?.({ ok: true, data: { roomCode: res.code } });
    });

    socket.on('room:join', (payload, ack) => {
      if (!requireAuth()) return;
      const code = String(payload?.code ?? '').toUpperCase().slice(0, 8);
      if (!code) {
        ack?.({ ok: false, error: 'Code required' });
        return;
      }
      const res = deps.roomManager.joinByCode({ ...me() }, code);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      joinRoomSocket(code);
      ack?.({ ok: true, data: { roomCode: code } });
    });

    socket.on('room:leave', (_p: unknown, ack) => {
      if (!requireAuth()) return;
      const code = me().roomCode;
      const room = code ? deps.roomManager.get(code) : undefined;
      if (room) {
        // LOBBY'da ro'yxatdan o'chiradi, o'yin davomida esa "o'lgan" qilib chetlatadi
        room.engine.kickPlayer(me().userId);
        deps.roomManager.detachSocket(code!, me().userId, socket.id);
        socket.leave(`room:${code}`);
        // Oxirgi odam chiqsa xona darhol yopiladi (60s kutilmaydi)
        const closed = deps.roomManager.sweepRoom(code!);
        if (!closed) {
          const still = deps.roomManager.get(code!);
          if (still && still.engine.phase === 'LOBBY') emitRoomState(still);
        }
      }
      socket.data.roomCode = undefined;
      ack?.({ ok: true });
    });

    socket.on('room:ready', (payload, ack) => {
      if (!requireAuth()) return;
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      room.engine.setReady(me().userId, !!payload?.ready);
      ack?.({ ok: true });
      emitRoomState(room);
    });

    socket.on('room:pickRole', (payload, ack) => {
      if (!requireAuth()) return;
      if (!limiter.check(`pick:${me().userId}`, RATE_LIMITS.action)) {
        ack?.({ ok: false, error: 'Slow down' });
        return;
      }
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      const raw = payload?.roleId;
      const roleId =
        raw === null || raw === undefined
          ? null
          : typeof raw === 'string'
            ? (raw.toUpperCase() as import('@truemafia/shared').RoleId)
            : null;
      if (roleId !== null && !/^[A-Z_]+$/.test(roleId)) {
        ack?.({ ok: false, error: 'Bad role' });
        return;
      }
      const res = room.engine.pickRole(me().userId, roleId);
      ack?.(res.ok ? { ok: true } : { ok: false, error: res.error });
      if (res.ok) emitRoomState(room);
    });

    socket.on('room:start', (payload, ack) => {
      if (!requireAuth()) return;
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a room' });
        return;
      }
      const addBots = clampInt(payload?.addBots ?? 0, 0, 14, 0);
      if (addBots > 0 && isDemoAllowed()) {
        bridgeEngine(room.engine);
        deps.botControllers.get(room.engine.code)?.addBots(addBots);
      }
      const res = room.engine.start(me().userId);
      if (!res.ok) {
        ack?.({ ok: false, error: res.error });
        return;
      }
      ack?.({ ok: true });
      room.engine.broadcastSnapshot();
    });

    socket.on('game:action', (payload, ack) => {
      if (!requireAuth()) return;
      if (!limiter.check(`action:${me().userId}`, RATE_LIMITS.action)) {
        ack?.({ ok: false, error: 'Slow down' });
        return;
      }
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a game' });
        return;
      }
      const targetId = clampInt(payload?.targetId, -1, 2 ** 53, -1);
      const res = room.engine.submitNightAction(me().userId, targetId);
      ack?.(res.ok ? { ok: true } : { ok: false, error: res.error });
    });

    socket.on('game:vote', (payload, ack) => {
      if (!requireAuth()) return;
      if (!limiter.check(`vote:${me().userId}`, RATE_LIMITS.vote)) {
        ack?.({ ok: false, error: 'Slow down' });
        return;
      }
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a game' });
        return;
      }
      const targetId = clampInt(payload?.targetId, -1, 2 ** 53, -1);
      const res = room.engine.castVote(me().userId, targetId);
      ack?.(res.ok ? { ok: true } : { ok: false, error: res.error });
    });

    socket.on('game:continue', (_p: unknown, ack) => {
      if (!requireAuth()) return;
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a game' });
        return;
      }
      room.engine.requestContinue(me().userId);
      ack?.({ ok: true });
    });

    socket.on('chat:send', (payload, ack) => {
      if (!requireAuth()) return;
      if (!limiter.check(`chat:${me().userId}`, RATE_LIMITS.chat)) {
        ack?.({ ok: false, error: 'Slow down' });
        return;
      }
      const room = findMyRoom();
      if (!room) {
        ack?.({ ok: false, error: 'Not in a game' });
        return;
      }
      const channel: ChatMessage['channel'] =
        payload?.channel === 'mafia' || payload?.channel === 'ghosts' ? payload.channel : 'day';
      const text = String(payload?.text ?? '').slice(0, CHAT_MAX_LEN);
      const res = room.engine.chatSend(me().userId, channel, text);
      ack?.(res.ok ? { ok: true } : { ok: false, error: res.error });
    });

    socket.on('chat:typing', (payload) => {
      const code = me().roomCode;
      if (!code) return;
      const channel =
        payload?.channel === 'mafia' || payload?.channel === 'ghosts' ? payload.channel : 'day';
      socket.to(`room:${code}`).emit('typing', {
        channel,
        userId: me().userId,
        name: me().displayName,
      });
    });

    socket.on('disconnect', () => {
      const code = me().roomCode;
      if (code) {
        deps.roomManager.detachSocket(code, me().userId, socket.id);
        // Ilovani yopib chiqqanlar (leave bosmasdan) — bo'sh xona darhol yopiladi
        deps.roomManager.sweepRoom(code);
      }
    });
  });

  function emitRoomState(room: NonNullable<ReturnType<RoomManager['get']>>): void {
    const e = room.engine;
    const roomPayload = {
      code: e.code,
      phase: e.phase,
      players: e.publicPlayers(),
      settings: e.settings,
      hostId: e.hostId,
      rolePicks: e.getRolePicks(),
    };
    for (const p of e.players) {
      if (p.isBot) continue;
      io.to(`user:${p.userId}`).emit('room:state', {
        room: roomPayload,
        you: {
          isHost: e.hostId === p.userId,
          ready: (e as unknown as { ready: Set<number> }).ready.has(p.userId),
        },
      });
    }
  }

  function isDemoAllowed(): boolean {
    return process.env.DEV_BOTS === '1' && process.env.NODE_ENV !== 'production';
  }

  return io;
}

function noopHooks(): EngineHooks {
  return {
    onSnapshot: () => {},
    onChat: () => {},
    onToast: () => {},
    onAchievement: () => {},
    onGameOver: () => {},
    onPhaseChanged: () => {},
  };
}

function sanitizeSettings(input: unknown): Partial<RoomSettings> {
  if (!input || typeof input !== 'object') return {};
  const s = input as Record<string, unknown>;
  const out: Partial<RoomSettings> = {};
  if (s.gameType && ['CLASSIC', 'ADVANCED', 'CUSTOM'].includes(s.gameType as string)) {
    out.gameType = s.gameType as RoomSettings['gameType'];
  }
  if (typeof s.playerCount === 'number') out.playerCount = clampInt(s.playerCount, 4, 15, 8);
  if (typeof s.mafiaCount === 'number') out.mafiaCount = clampInt(s.mafiaCount, 1, 7, 2);
  const boolKeys = [
    'donEnabled',
    'doctorEnabled',
    'detectiveEnabled',
    'bodyguardEnabled',
    'serialKillerEnabled',
    'jesterEnabled',
    'privateRoom',
    'revealRolesOnDeath',
    'anonymousVoting',
    'roleDraft',
  ] as const;
  for (const k of boolKeys) {
    if (typeof s[k] === 'boolean') out[k] = s[k] as boolean;
  }
  if (typeof s.botCount === 'number') out.botCount = clampInt(s.botCount, 0, 14, 0);
  if (typeof s.discussionSeconds === 'number') {
    out.discussionSeconds = clampInt(s.discussionSeconds, 30, 600, 180);
  }
  if (typeof s.votingSeconds === 'number') {
    out.votingSeconds = clampInt(s.votingSeconds, 15, 300, 60);
  }
  if (typeof s.nightSeconds === 'number') {
    out.nightSeconds = clampInt(s.nightSeconds, 15, 300, 45);
  }
  return out;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? Math.floor(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
