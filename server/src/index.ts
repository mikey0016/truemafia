import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load .env: cwd (root yoki server workspace) + repo root (__dirname'dan).
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import type { Server as IOServer } from 'socket.io';
import { APP_VERSION } from '@truemafia/shared';
import { createDb } from './database/db.js';
import { migrate } from './database/migrate.js';
import { UserService } from './services/userService.js';
import { GameRecorder } from './services/gameRecorder.js';
import { RoomManager } from './game/roomManager.js';
import { createSocketServer } from './websocket/handler.js';
import { createApiRouter } from './routes/api.js';
import { authMiddleware } from './middleware/auth.js';
import { startTelegramBot } from './bot/bot.js';
import type { BotController } from './game/bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tsx'da cwd server/ bo'lishi mumkin — repo root'dagi .env'ni ham yuklash
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main(): Promise<void> {
  await loadTsx();
  const db = await createDb();
  await migrate(db);

  const users = new UserService(db);
  await users.seedAchievements();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  app.use('/api/auth', authMiddleware, (req, res) => {
    res.json({
      ok: true,
      user: req.tgUser,
    });
  });

  const rooms = new RoomManager(db);
  rooms.startCleanupLoop();

  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      time: Date.now(),
      version: APP_VERSION,
      adminConfigured: (process.env.ADMIN_IDS || '').trim().length > 0,
    }),
  );

  // Ochiq xonalar — auth'siz (Find a game ro'yxati uchun).
  // Auth talab qilinadigan router'dan OLDIN turishi shart.
  app.get('/api/rooms', (_req, res) => {
    const list = [...rooms.rooms.values()]
      .filter((r) => {
        const e = r.engine;
        return (
          !e.settings.privateRoom && e.phase === 'LOBBY' && e.players.length < e.settings.playerCount
        );
      })
      .sort((a, b) => a.engine.startedAtTime - b.engine.startedAtTime)
      .slice(0, 20)
      .map((r) => ({
        code: r.engine.code,
        players: r.engine.players.length,
        maxPlayers: r.engine.settings.playerCount,
        phase: r.engine.phase,
      }));
    res.json({ rooms: list });
  });

  const ioHolder: { io?: IOServer } = {};
  app.use('/api', authMiddleware, createApiRouter({ db, users, rooms, ioHolder }));

  // SPA fallback: built client'dagi barcha no-API route'lar index.html ga qaytadi
  const indexHtml = path.join(clientDist, 'index.html');
  app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res, next) => {
    if (!fs.existsSync(indexHtml)) return next();
    res.sendFile(indexHtml);
  });

  const server = http.createServer(app);
  const botControllers = new Map<string, BotController>();
  const recorder = new GameRecorder(db, (userId, count) => users.recordDetectiveFind(userId, count));
  const io: IOServer = createSocketServer(server, {
    roomManager: rooms,
    users,
    recorder,
    botControllers,
  });
  ioHolder.io = io;
  void io;

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, () => {
    console.log(`[true-mafia] server listening on :${port}`);
  });

  // Telegram bot: /start -> info + Mini App tugmasi (BOT_TOKEN bo'lsa polling)
  const stopBot = startTelegramBot();

  const shutdown = async () => {
    console.log('[true-mafia] shutting down...');
    stopBot();
    rooms.dispose();
    for (const room of rooms.rooms.values()) room.engine.dispose();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[true-mafia] fatal:', err);
  process.exit(1);
});

async function loadTsx(): Promise<void> {
  // no-op; tsx handles TS execution in dev/start
  await Promise.resolve();
}
