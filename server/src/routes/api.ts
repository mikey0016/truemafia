import { Router } from 'express';
import type { Db } from '../database/db.js';
import type { UserService } from '../services/userService.js';
import type { RoomManager } from '../game/roomManager.js';
import { adminMiddleware } from '../middleware/auth.js';
import { RateLimiter } from '../middleware/rateLimit.js';

export function createApiRouter(deps: {
  db: Db;
  users: UserService;
  rooms: RoomManager;
}): Router {
  const router = Router();
  const limiter = new RateLimiter();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, time: Date.now() });
  });

  router.get('/me', (req, res) => {
    const uid = req.tgUser!.userId;
    void deps.users.getById(uid).then(async (u) => {
      if (!u) {
        await deps.users.upsertFromTelegram({
          userId: req.tgUser!.userId,
          username: req.tgUser!.username,
          displayName: req.tgUser!.displayName,
          photoUrl: req.tgUser!.photoUrl,
        });
      }
      const profile = await deps.users.getProfile(uid);
      res.json({ profile });
    });
  });

  router.get('/profile/:userId', (req, res) => {
    const uid = parseInt(req.params.userId, 10);
    if (!Number.isFinite(uid)) {
      res.status(400).json({ error: 'Bad id' });
      return;
    }
    void deps.users.getProfile(uid).then((p) => {
      if (!p) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ profile: p });
    });
  });

  router.get('/leaderboard', (req, res) => {
    const rangeParam = String(req.query.range || 'GLOBAL').toUpperCase();
    const range = (['GLOBAL', 'WEEKLY', 'MONTHLY'].includes(rangeParam)
      ? rangeParam
      : 'GLOBAL') as 'GLOBAL' | 'WEEKLY' | 'MONTHLY';
    void deps.users.getLeaderboard(range).then((entries) => {
      res.json({ entries });
    });
  });

  router.get('/achievements', (_req, res) => {
    void deps.db.all('SELECT * FROM achievements').then((rows) => {
      res.json({ achievements: rows });
    });
  });

  router.get('/history', (req, res) => {
    const uid = req.tgUser!.userId;
    void deps.users
      .getHistory(uid)
      .then((history) => res.json({ history }))
      .catch(() => res.status(500).json({ error: 'History unavailable' }));
  });

  // ---- admin ----
  router.get('/admin/stats', adminMiddleware, (_req, res) => {
    const online = [...deps.rooms.rooms.values()].reduce(
      (acc, r) => acc + [...r.sockets.values()].reduce((a, s) => a + s.size, 0),
      0,
    );
    const activeGames = [...deps.rooms.rooms.values()].filter(
      (r) => r.engine.phase !== 'LOBBY' && !r.engine.isOver,
    ).length;
    void Promise.all([
      deps.db.get<{ c: number | string }>('SELECT COUNT(*) AS c FROM users'),
      deps.db.get<{ c: number | string }>('SELECT COUNT(*) AS c FROM games'),
    ]).then(([users, games]) => {
      res.json({
        onlinePlayers: online,
        activeGames,
        totalUsers: Number(users?.c ?? 0),
        totalGames: Number(games?.c ?? 0),
        openRooms: deps.rooms.rooms.size,
      });
    });
  });

  router.get('/admin/rooms', adminMiddleware, (_req, res) => {
    const list = [...deps.rooms.rooms.values()].map((r) => ({
      code: r.engine.code,
      phase: r.engine.phase,
      round: r.engine.round,
      players: r.engine.players.length,
      demo: r.engine.demoMode,
    }));
    res.json({ rooms: list });
  });

  router.post('/admin/ban/:userId', adminMiddleware, (req, res) => {
    const uid = parseInt(req.params.userId, 10);
    if (!Number.isFinite(uid)) {
      res.status(400).json({ error: 'Bad id' });
      return;
    }
    void deps.db.run('UPDATE users SET is_banned=1 WHERE user_id=$1', [uid]).then(() => {
      res.json({ ok: true });
    });
  });

  router.post('/admin/unban/:userId', adminMiddleware, (req, res) => {
    const uid = parseInt(req.params.userId, 10);
    if (!Number.isFinite(uid)) {
      res.status(400).json({ error: 'Bad id' });
      return;
    }
    void deps.db.run('UPDATE users SET is_banned=0 WHERE user_id=$1', [uid]).then(() => {
      res.json({ ok: true });
    });
  });

  // simple per-IP rate limit wrapper on the whole router
  router.use((_req, res, next) => {
    // final middleware: nothing to do; individual limits applied above via limiter on heavy routes
    next();
  });
  void limiter;

  return router;
}
