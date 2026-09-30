/**
 * GameRecorder test: verifies finished games persist to the DB and that
 * user progression (XP, wins, streaks, achievements, detective finds)
 * and the weekly leaderboard update correctly.
 * Run: npm -w server run test
 */
import type { GameSnapshot, ChatMessage } from '@truemafia/shared';
import { DEFAULT_SETTINGS } from '@truemafia/shared';
import { createDb, type Db } from '../database/db.js';
import { migrate } from '../database/migrate.js';
import { UserService } from '../services/userService.js';
import { GameRecorder, didPlayerWin } from '../services/gameRecorder.js';
import { GameEngine } from '../game/engine.js';

function makeHooks() {
  return {
    onSnapshot: (_map: Map<number, GameSnapshot>) => {},
    onChat: (_msg: ChatMessage, _aud: (p: import('../game/types.js').GamePlayer) => boolean) => {},
    onToast: () => {},
    onAchievement: () => {},
    onGameOver: () => {},
    onPhaseChanged: () => {},
  };
}

async function setup(): Promise<{
  db: Db;
  users: UserService;
  recorder: GameRecorder;
}> {
  const db = await createDb(':memory:');
  await migrate(db);
  const users = new UserService(db);
  await users.seedAchievements();
  const recorder = new GameRecorder(db, (userId, count) =>
    users.recordDetectiveFind(userId, count),
  );
  return { db, users, recorder };
}

function finishedEngine(opts: {
  roomId: number | null;
  players: { userId: number; username: string; role: string; alive: boolean; isBot?: boolean; finds?: number }[];
  winner: 'TOWN' | 'MAFIA' | 'INDEPENDENT';
}): GameEngine {
  const engine = new GameEngine(
    {
      code: 'TST' + Math.floor(Math.random() * 900 + 100),
      roomId: opts.roomId,
      settings: { ...DEFAULT_SETTINGS },
      demoMode: false,
    },
    makeHooks(),
  );
  for (const p of opts.players) {
    engine.addPlayer({
      userId: p.userId,
      username: p.username,
      displayName: p.username,
      isBot: p.isBot ?? false,
    });
  }
  // force a finished state without running the full state machine
  engine.phase = 'GAME_OVER';
  engine.round = 3;
  for (const p of engine.players) {
    const spec = opts.players.find((x) => x.userId === p.userId)!;
    p.role = spec.role as GameEngine['players'][number]['role'];
    p.alive = spec.alive;
    p.investigations = (spec.finds ?? 0) > 0
      ? Array.from({ length: spec.finds! }, (_, i) => ({ targetId: 1000 + i, result: 'MAFIA' as const }))
      : [];
  }
  engine.hostId = opts.players[0].userId;
  return engine;
}

async function main(): Promise<void> {
  const { db, users, recorder } = await setup();

  // -- didPlayerWin sanity --
  if (!didPlayerWin('MAFIA', 'MAFIA')) throw new Error('mafia should win with MAFIA');
  if (!didPlayerWin('DON', 'MAFIA')) throw new Error('don should win with MAFIA');
  if (didPlayerWin('CITIZEN', 'MAFIA')) throw new Error('citizen should NOT win with MAFIA');
  if (!didPlayerWin('JESTER', 'INDEPENDENT')) throw new Error('jester should win with INDEPENDENT');

  // -- record a game: mafia win, 2 humans + 2 bots --
  await users.upsertFromTelegram({ userId: 1, username: 'u1', displayName: 'User One' });
  await users.upsertFromTelegram({ userId: 2, username: 'u2', displayName: 'User Two' });

  const engine = finishedEngine({
    roomId: 42,
    players: [
      { userId: 1, username: 'u1', role: 'MAFIA', alive: true },
      { userId: 2, username: 'u2', role: 'CITIZEN', alive: false, finds: 2 },
      { userId: 900, username: 'bot1', role: 'DON', alive: false, isBot: true },
      { userId: 901, username: 'bot2', role: 'DOCTOR', alive: true, isBot: true },
    ],
    winner: 'MAFIA',
  });
  const unlocks = await recorder.recordFinishedGame(engine, 'MAFIA', 'The Mafia outnumbers the town.');

  // game + game_players persisted (bots skipped)
  const games = await db.all('SELECT * FROM games');
  if (games.length !== 1) throw new Error(`expected 1 game row, got ${games.length}`);
  if (Number(games[0].room_id) !== 42) throw new Error('game.room_id mismatch');
  if (games[0].winner !== 'MAFIA') throw new Error('game.winner mismatch');
  const gps = await db.all<{ user_id: number }>('SELECT user_id FROM game_players');
  const ids = gps.map((r) => Number(r.user_id)).sort();
  if (JSON.stringify(ids) !== '[1,2]') throw new Error(`expected human-only game_players [1,2], got ${ids}`);

  // stats: u1 won as mafia, u2 lost but survived to record... (u2 is dead -> not survived)
  const p1 = await users.getProfile(1);
  const p2 = await users.getProfile(2);
  if (!p1 || !p2) throw new Error('profiles missing');
  if (p1.games !== 1 || p1.wins !== 1 || p1.mafiaWins !== 1) {
    throw new Error(`u1 stats wrong: ${JSON.stringify(p1)}`);
  }
  // 50 XP < xpForLevel(1)=100, so still level 1
  if (p1.level !== 1 || p1.xp !== 50) throw new Error(`u1 xp/level wrong: ${p1.level}/${p1.xp}`);
  if (p2.games !== 1 || p2.wins !== 0) throw new Error(`u2 stats wrong: ${JSON.stringify(p2)}`);

  // achievements: u1 FIRST_BLOOD; u2 nothing yet (1 find < 10)
  if (!p1.achievements.some((a) => a.id === 'FIRST_BLOOD')) throw new Error('u1 missing FIRST_BLOOD');
  if (p2.achievements.some((a) => a.id === 'DETECTIVE')) throw new Error('u2 should not have DETECTIVE yet');
  if (unlocks.some((u) => u.id === 'DETECTIVE')) throw new Error('DETECTIVE unlocked too early');

  // -- detective finds accumulate across games --
  const engine2 = finishedEngine({
    roomId: null,
    players: [
      { userId: 2, username: 'u2', role: 'DETECTIVE', alive: true, finds: 8 },
    ],
    winner: 'TOWN',
  });
  const unlocks2 = await recorder.recordFinishedGame(engine2, 'TOWN', 'All threats eliminated.');
  const p2b = await users.getProfile(2);
  if (!p2b) throw new Error('u2 missing');
  if (!p2b.achievements.some((a) => a.id === 'DETECTIVE')) throw new Error('u2 missing DETECTIVE after 10 finds');
  if (!unlocks2.some((u) => u.userId === 2 && u.id === 'DETECTIVE')) {
    throw new Error('DETECTIVE not reported in unlocks');
  }

  // -- weekly leaderboard counts only role-correct wins --
  const lb = await users.getLeaderboard('WEEKLY');
  const u1row = lb.find((e) => e.userId === 1);
  const u2row = lb.find((e) => e.userId === 2);
  if (!u1row || u1row.wins !== 1 || u1row.games !== 1) throw new Error(`u1 weekly row wrong: ${JSON.stringify(u1row)}`);
  if (!u2row || u2row.wins !== 1 || u2row.games !== 2) throw new Error(`u2 weekly row wrong: ${JSON.stringify(u2row)}`);

  // -- history: newest first, correct win flags --
  const h1 = await users.getHistory(1);
  if (h1.length !== 1) throw new Error(`u1 history length wrong: ${h1.length}`);
  if (!h1[0].won || h1[0].role !== 'MAFIA' || h1[0].winner !== 'MAFIA' || !h1[0].alive) {
    throw new Error(`u1 history entry wrong: ${JSON.stringify(h1[0])}`);
  }
  const h2 = await users.getHistory(2);
  if (h2.length !== 2) throw new Error(`u2 history length wrong: ${h2.length}`);
  if (!(h2[0].finishedAt >= h2[1].finishedAt)) throw new Error('history not sorted newest first');
  const u2loss = h2.find((g) => g.role === 'CITIZEN');
  if (!u2loss || u2loss.won || u2loss.alive) throw new Error(`u2 loss entry wrong: ${JSON.stringify(u2loss)}`);
  const u2win = h2.find((g) => g.role === 'DETECTIVE');
  if (!u2win || !u2win.won || !u2win.alive) throw new Error(`u2 win entry wrong: ${JSON.stringify(u2win)}`);

  console.log('PASS: gameRecorder persisted games, stats, achievements, history, and leaderboard.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
