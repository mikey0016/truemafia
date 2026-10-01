import type { RoomSettings } from '@truemafia/shared';
import { DEFAULT_SETTINGS } from '@truemafia/shared';
import { GameEngine } from './engine.js';
import type { GameEventHooks, RoomLike } from './types.js';
import type { Db } from '../database/db.js';

export interface ManagedRoom {
  engine: GameEngine;
  /** userId -> set of socket ids currently attached */
  sockets: Map<number, Set<string>>;
}

export interface JoinUser {
  userId: number;
  username: string;
  displayName: string;
  photoUrl?: string;
}

/** Xona yopilganda mijozlarga xabar yuborish uchun io reference (createSocketServer tomonidan o'rnatiladi). */
let ioNotify: { emitToSocket: (socketId: string, event: string, payload: unknown) => void } | null =
  null;

export function setRoomCloseNotifier(
  notifier: { emitToSocket: (socketId: string, event: string, payload: unknown) => void } | null,
): void {
  ioNotify = notifier;
}

export class RoomManager {
  rooms = new Map<string, ManagedRoom>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private db: Db) {}

  async createRoom(
    host: JoinUser,
    settings: Partial<RoomSettings>,
    demoBots: number,
    hooks: GameEventHooks,
  ): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();
    const roomId = await this.persistRoom(code, host.userId, settings, demoBots > 0);
    const roomLike: RoomLike = {
      code,
      roomId,
      settings: mergedSettings(settings),
      demoMode: demoBots > 0,
    };
    const engine = new GameEngine(roomLike, hooks);
    engine.hostId = host.userId;
    engine.addPlayer(host);
    const managed: ManagedRoom = { engine, sockets: new Map() };
    this.rooms.set(code, managed);
    engine.startHeartbeat();
    return { ok: true, code };
  }

  quickJoin(user: JoinUser): { ok: boolean; code?: string; error?: string } {
    const candidates = [...this.rooms.values()]
      .filter((r) => {
        const e = r.engine;
        return (
          !e.settings.privateRoom &&
          e.phase === 'LOBBY' &&
          e.players.length < e.settings.playerCount &&
          !e.players.some((p) => p.userId === user.userId)
        );
      })
      .sort((a, b) => a.engine.startedAtTime - b.engine.startedAtTime);
    if (candidates.length === 0) return { ok: false, error: 'Ochiq xona yo�q. Yarating!' };
    const target = candidates[0].engine;
    const res = target.addPlayer(user);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, code: target.code };
  }

  joinByCode(user: JoinUser, code: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { ok: false, error: 'Xona topilmadi' };
    const e = room.engine;
    if (!e.players.some((p) => p.userId === user.userId)) {
      if (e.phase !== 'LOBBY') return { ok: false, error: 'O�yin allaqachon boshlangan' };
      const res = e.addPlayer(user);
      if (!res.ok) return { ok: false, error: res.error };
    }
    return { ok: true };
  }

  get(code: string): ManagedRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getByPlayer(userId: number): ManagedRoom | undefined {
    for (const r of this.rooms.values()) {
      if (r.engine.players.some((p) => p.userId === userId)) return r;
    }
    return undefined;
  }

  attachSocket(code: string, userId: number, socketId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    let set = room.sockets.get(userId);
    if (!set) {
      set = new Set();
      room.sockets.set(userId, set);
    }
    set.add(socketId);
    room.engine.setConnected(userId, true);
  }

  detachSocket(code: string, userId: number, socketId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    const set = room.sockets.get(userId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        // Bo'sh to'plam map'da qolsa everyoneGone hech qachon ishlamaydi (ghost xona)
        room.sockets.delete(userId);
        room.engine.setConnected(userId, false);
      }
    }
  }

  async closeRoom(code: string, notifyReason?: string): Promise<void> {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    room.engine.dispose();
    this.rooms.delete(code.toUpperCase());
    if (notifyReason) {
      // xonada qolgan (socketi bor) o'yinchilarga xabar — klient bosh sahifaga qaytadi
      for (const sockets of room.sockets.values()) {
        for (const sid of sockets) {
          ioNotify?.emitToSocket(sid, 'room:closed', { reason: notifyReason });
        }
      }
    }
    if (room.engine.room.roomId !== null) {
      await this.db.run(`UPDATE rooms SET closed_at=$1 WHERE id=$2`, [
        Date.now(),
        room.engine.room.roomId,
      ]);
    }
  }

  private async persistRoom(
    code: string,
    hostId: number,
    settings: Partial<RoomSettings>,
    demo: boolean,
  ): Promise<number | null> {
    try {
      const res = await this.db.run(
        `INSERT INTO rooms (code, host_id, settings, phase, demo_mode, created_at)
         VALUES ($1,$2,$3,'LOBBY',$4,$5) RETURNING id`,
        [code, hostId, JSON.stringify(settings), demo ? 1 : 0, Date.now()],
      );
      const row = res.rows[0] as { id: number | string } | undefined;
      return row ? Number(row.id) : null;
    } catch {
      return null;
    }
  }

  /**
   * Tashlab ketilgan xonani DARHOL yopish (leave/disconnect'dan keyin chaqiriladi).
   * O'yin o'rtasida aloqasi uzilganlar uchun 60s lik loop reconnect imkoni beradi —
   * bu yerda faqat rostdan bo'sh xonalar yopiladi. Yopilgan bo'lsa true.
   */
  sweepRoom(code: string): boolean {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return false;
    const e = room.engine;
    const humans = e.players.filter((p) => !p.isBot);
    const connected = humans.filter((p) => room.sockets.has(p.userId));
    const abandoned =
      humans.length === 0 || // hech kim qolmagan (faqat botlar bo'lishi mumkin)
      ((e.phase === 'LOBBY' || e.isOver) && connected.length === 0); // lobby tashlandi / o'yin tugagan
    if (!abandoned) return false;
    void this.closeRoom(
      code,
      humans.length > 0 ? 'Room closed — everyone left' : undefined,
    );
    return true;
  }

  startCleanupLoop(): void {    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [code, room] of this.rooms) {
        const e = room.engine;
        const humans = e.players.filter((p) => !p.isBot);
        const noHumans = humans.length === 0;
        const emptyLobby = e.phase === 'LOBBY' && e.players.length === 0;
        const everyoneGone =
          humans.length > 0 && humans.every((p) => !p.connected && !room.sockets.has(p.userId));
        // O'yin tugagan va odam qolmasa — 2 daqiqada yopish (natija ekranini ko'rishga vaqt beradi)
        const finishedEmpty = e.isOver && noHumans;
        const stale = now - e.startedAtTime > 3 * 3600_000;
        if (noHumans || everyoneGone || emptyLobby || finishedEmpty || (stale && e.isOver)) {
          void this.closeRoom(code, everyoneGone || (noHumans && !emptyLobby) ? 'Room closed — everyone left' : undefined);
        }
      }
    }, 60_000);
    this.cleanupTimer.unref();
  }

  dispose(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

function mergedSettings(partial: Partial<RoomSettings>): RoomSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

function generateCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
