import type { Db } from '../database/db.js';
import {
  ACHIEVEMENTS,
  type GameHistoryEntry,
  type LeaderboardEntry,
  type ProfileStats,
} from '@truemafia/shared';

export interface UserRow {
  user_id: number | string;
  username: string;
  display_name: string;
  photo_url: string | null;
  level: number;
  xp: number;
  coins: number;
  reputation: number;
  games: number;
  wins: number;
  mafia_wins: number;
  town_wins: number;
  independent_wins: number;
  best_streak: number;
  current_streak: number;
  games_survived: number;
  is_banned: number;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : (v as number);
  return Number.isFinite(n) ? (n as number) : 0;
}

export const DETECTIVE_FINDS_REQUIRED = 10;

export function xpForLevel(level: number): number {
  // 100 XP per level, with mild growth
  return 100 + (level - 1) * 25;
}

export class UserService {
  constructor(private db: Db) {}

  async upsertFromTelegram(u: {
    userId: number;
    username: string;
    displayName: string;
    photoUrl?: string;
  }): Promise<UserRow> {
    const now = Date.now();
    // NOTE: pass `now` twice — the Db layer maps $n -> ? positionally, so
    // repeating $5 would shift the placeholder indices and NULL out created_at.
    await this.db.run(
      `INSERT INTO users (user_id, username, display_name, photo_url, last_seen_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
         last_seen_at = EXCLUDED.last_seen_at`,
      [u.userId, u.username, u.displayName, u.photoUrl ?? null, now, now],
    );
    const row = await this.db.get<UserRow>('SELECT * FROM users WHERE user_id = $1', [u.userId]);
    return row as UserRow;
  }

  async getById(userId: number): Promise<UserRow | undefined> {
    return this.db.get<UserRow>('SELECT * FROM users WHERE user_id = $1', [userId]);
  }

  /**
   * Called by the recorder with the number of successful mafia identifications
   * made in a finished game. Unlocks DETECTIVE at 10 cumulative finds.
   */
  async recordDetectiveFind(userId: number, count = 1): Promise<boolean> {
    await this.db.run(
      `UPDATE users SET detective_finds = detective_finds + $1 WHERE user_id = $2`,
      [count, userId],
    );
    const row = await this.db.get<{ detective_finds: number | string }>(
      `SELECT detective_finds FROM users WHERE user_id = $1`,
      [userId],
    );
    const finds = num(row?.detective_finds);
    if (finds < DETECTIVE_FINDS_REQUIRED) return false;
    try {
      await this.db.run(
        `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1,'DETECTIVE',$2)`,
        [userId, Date.now()],
      );
      return true;
    } catch {
      return false; // already unlocked (PK conflict)
    }
  }

  async grantAchievement(userId: number, id: string): Promise<boolean> {
    try {
      await this.db.run(
        `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, $3)`,
        [userId, id, Date.now()],
      );
      return true;
    } catch {
      return false; // already unlocked (PK conflict)
    }
  }

  async getProfile(userId: number): Promise<ProfileStats | null> {
    const u = await this.getById(userId);
    if (!u) return null;
    const achievements = await this.db.all<{ achievement_id: string; unlocked_at: number | string }>(
      'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1',
      [userId],
    );
    const games = num(u.games);
    const wins = num(u.wins);
    return {
      userId: num(u.user_id),
      username: u.username,
      photoUrl: u.photo_url ?? undefined,
      level: num(u.level),
      xp: num(u.xp),
      xpToNext: xpForLevel(num(u.level)),
      games,
      wins,
      mafiaWins: num(u.mafia_wins),
      townWins: num(u.town_wins),
      independentWins: num(u.independent_wins),
      winRate: games > 0 ? Math.round((wins / games) * 100) : 0,
      bestStreak: num(u.best_streak),
      currentStreak: num(u.current_streak),
      reputation: num(u.reputation),
      coins: num(u.coins),
      achievements: achievements.map((a) => ({
        id: a.achievement_id,
        unlockedAt: num(a.unlocked_at),
      })),
    };
  }

  async getLeaderboard(range: 'GLOBAL' | 'WEEKLY' | 'MONTHLY'): Promise<LeaderboardEntry[]> {
    if (range === 'GLOBAL') {
      const rows = await this.db.all<UserRow>(
        `SELECT * FROM users WHERE is_banned=0 ORDER BY reputation DESC, wins DESC LIMIT 50`,
      );
      return rows.map((r) => ({
        userId: num(r.user_id),
        username: r.username,
        photoUrl: r.photo_url ?? undefined,
        wins: num(r.wins),
        games: num(r.games),
        rating: num(r.reputation),
      }));
    }
    // WEEKLY / MONTHLY: wins = games finished in the window where the player's team won
    const since = Date.now() - (range === 'WEEKLY' ? 7 : 30) * 86400_000;
    const rows = await this.db.all<{
      user_id: number | string;
      username: string;
      photo_url: string | null;
      wins: number | string;
      games: number | string;
    }>(
      `SELECT gp.user_id, u.username, u.photo_url,
              SUM(CASE
                    WHEN (g.winner = 'MAFIA' AND gp.role IN ('MAFIA','DON'))
                      OR (g.winner = 'TOWN' AND gp.role NOT IN ('MAFIA','DON','SERIAL_KILLER','JESTER'))
                      OR (g.winner = 'INDEPENDENT' AND gp.role IN ('SERIAL_KILLER','JESTER'))
                  THEN 1 ELSE 0 END) as wins,
              COUNT(*) as games
         FROM game_players gp
         JOIN games g ON g.id = gp.game_id
         JOIN users u ON u.user_id = gp.user_id AND u.is_banned = 0
        WHERE g.finished_at >= $1 AND gp.is_bot = 0
        GROUP BY gp.user_id, u.username, u.photo_url
        ORDER BY wins DESC, games DESC
        LIMIT 50`,
      [since],
    );
    return rows.map((r) => ({
      userId: num(r.user_id),
      username: r.username,
      photoUrl: r.photo_url ?? undefined,
      wins: num(r.wins),
      games: num(r.games),
      rating: num(r.wins) * 20,
    }));
  }

  /** Last 20 finished games for a user, newest first. */
  async getHistory(userId: number): Promise<GameHistoryEntry[]> {
    const rows = await this.db.all<{
      id: number | string;
      finished_at: number | string;
      winner: string | null;
      round: number;
      role: string;
      alive: number;
    }>(
      `SELECT g.id, g.finished_at, g.winner, g.round, gp.role, gp.alive
         FROM game_players gp
         JOIN games g ON g.id = gp.game_id
        WHERE gp.user_id = $1 AND g.winner IS NOT NULL
        ORDER BY g.finished_at DESC
        LIMIT 20`,
      [userId],
    );
    return rows.map((r) => {
      const role = r.role as GameHistoryEntry['role'];
      const winner = (r.winner ?? null) as GameHistoryEntry['winner'];
      return {
        gameId: Number(r.id),
        finishedAt: Number(r.finished_at),
        winner,
        rounds: Number(r.round),
        role,
        alive: Number(r.alive) === 1,
        won:
          (winner === 'MAFIA' && (role === 'MAFIA' || role === 'DON')) ||
          (winner === 'INDEPENDENT' && (role === 'SERIAL_KILLER' || role === 'JESTER')) ||
          (winner === 'TOWN' &&
            role !== 'MAFIA' &&
            role !== 'DON' &&
            role !== 'SERIAL_KILLER' &&
            role !== 'JESTER'),
      };
    });
  }

  async seedAchievements(): Promise<void> {
    for (const a of ACHIEVEMENTS) {
      await this.db.run(
        `INSERT INTO achievements (id, name, description) VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [a.id, a.name, a.description],
      );
    }
  }

  async ownsItem(userId: number, itemId: string): Promise<boolean> {
    const row = await this.db.get<{ c: number | string }>(
      'SELECT COUNT(*) AS c FROM purchases WHERE user_id = $1 AND item_id = $2',
      [userId, itemId],
    );
    return num(row?.c) > 0;
  }

  async ownedItems(userId: number): Promise<string[]> {
    const rows = await this.db.all<{ item_id: string }>(
      'SELECT item_id FROM purchases WHERE user_id = $1',
      [userId],
    );
    return rows.map((r) => r.item_id);
  }

  /**
   * Marketdan sotib olish: coin yetarli + hali olinmagan bo'lsa yechib beradi.
   * Poyga holatida (ikki marta bosish) — ikkinchi urinish Already owned qaytaradi.
   */
  async buyItem(
    userId: number,
    itemId: string,
    price: number,
  ): Promise<{ ok: boolean; error?: string; balance?: number }> {
    if (await this.ownsItem(userId, itemId)) {
      const u = await this.getById(userId);
      return { ok: false, error: 'Already owned', balance: u ? num(u.coins) : undefined };
    }
    const u = await this.getById(userId);
    if (!u) return { ok: false, error: 'User not found' };
    if (num(u.coins) < price) return { ok: false, error: 'Not enough coins', balance: num(u.coins) };
    await this.db.run('UPDATE users SET coins = coins - $1 WHERE user_id = $2', [price, userId]);
    try {
      await this.db.run(
        'INSERT INTO purchases (user_id, item_id, created_at) VALUES ($1, $2, $3)',
        [userId, itemId, Date.now()],
      );
    } catch {
      // poyga: there — pulni qaytaramiz
      await this.db.run('UPDATE users SET coins = coins + $1 WHERE user_id = $2', [price, userId]);
      const cur = await this.getById(userId);
      return { ok: false, error: 'Already owned', balance: cur ? num(cur.coins) : undefined };
    }
    const cur = await this.getById(userId);
    return { ok: true, balance: cur ? num(cur.coins) : 0 };
  }
}
