import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load .env from cwd, then fall back to the repo root (npm workspace runs set cwd to server/).
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import type { Server as IOServer } from 'socket.io';
import { createDb } from './database/db.js';
import { migrate } from './database/migrate.js';
import { UserService } from './services/userService.js';
import { GameRecorder } from './services/gameRecorder.js';
import { RoomManager } from './game/roomManager.js';
import { createSocketServer } from './websocket/handler.js';
import { createApiRouter } from './routes/api.js';
import { authMiddleware } from './middleware/auth.js';
import type { BotController } from './game/bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
  app.use('/api', authMiddleware, createApiRouter({ db, users, rooms }));

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
  void io;

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, () => {
    console.log(`[true-mafia] server listening on :${port}`);
  });

  const shutdown = async () => {
    console.log('[true-mafia] shutting down...');
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
