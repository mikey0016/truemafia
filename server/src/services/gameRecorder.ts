import type { Db } from '../database/db.js';
import { isMafia } from '../game/engine.js';
import type { GameEngine } from '../game/engine.js';
import type { RoleId, Team } from '@truemafia/shared';

export interface NewUnlock {
  userId: number;
  id: string;
}

/**
 * Persists a finished game (games + game_players) and updates per-user
 * progression: XP/level, wins, streaks, reputation, achievements.
 * Bots are skipped — they have no user rows.
 */
export class GameRecorder {
  constructor(
    private db: Db,
    private recordDetectiveFind: (userId: number, count: number) => Promise<boolean>,
  ) {}

  async recordFinishedGame(engine: GameEngine, winner: Team, reason: string): Promise<NewUnlock[]> {
    // Botli (demo) o'yinlar reytingga yozilmaydi — boosting oldini olish uchun.
    if (engine.demoMode) return [];
    const humans = engine.players.filter((p) => !p.isBot);
    if (humans.length === 0) return [];
    const unlocks: NewUnlock[] = [];

    let gameId: number | null = null;
    try {
      const res = await this.db.run(
        `INSERT INTO games (room_id, round, phase, settings, winner, started_at, finished_at, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          // room_id is NOT NULL; 0 = in-memory room that was never persisted
          engine.room.roomId ?? 0,
          engine.round,
          engine.phase,
          JSON.stringify(engine.settings),
          winner,
          engine.startedAtTime,
          Date.now(),
          engine.startedAtTime ? Date.now() - engine.startedAtTime : 0,
        ],
      );
      const row = res.rows[0] as { id: number | string } | undefined;
      gameId = row ? Number(row.id) : null;
    } catch (err) {
      console.error('[recorder] failed to insert game:', err);
    }

    for (const p of humans) {
      if (gameId !== null) {
        try {
          await this.db.run(
            `INSERT INTO game_players (game_id, user_id, username, role, alive, is_bot, killed_in_round, death_cause)
             VALUES ($1,$2,$3,$4,$5,0,$6,$7)`,
            [
              gameId,
              p.userId,
              p.username,
              p.role,
              p.alive ? 1 : 0,
              p.deathRound ?? null,
              p.deathCause ?? null,
            ],
          );
        } catch (err) {
          console.error('[recorder] failed to insert game_player:', err);
        }
      }

      const won = didPlayerWin(p.role, winner);
      try {
        const newIds = await this.updateUserStats(p.userId, {
          won,
          team: playerTeam(p.role),
          survived: p.alive,
          wonAsLastSurvivor: won && p.alive && engine.alivePlayers().length === 1,
        });
        for (const id of newIds) unlocks.push({ userId: p.userId, id });
      } catch (err) {
        console.error('[recorder] failed to update user stats:', err);
      }

      // DETECTIVE: successful mafia identifications accumulate across games
      const finds = p.investigations.filter((i) => i.result === 'MAFIA').length;
      if (finds > 0) {
        try {
          if (await this.recordDetectiveFind(p.userId, finds)) {
            unlocks.push({ userId: p.userId, id: 'DETECTIVE' });
          }
        } catch (err) {
          console.error('[recorder] failed to record detective finds:', err);
        }
      }
    }

    if (gameId !== null) {
      console.log(`[recorder] game ${gameId} (room ${engine.code}) recorded: ${winner} — ${reason}`);
    }
    return unlocks;
  }

  private async updateUserStats(
    userId: number,
    opts: { won: boolean; team: Team; survived: boolean; wonAsLastSurvivor: boolean },
  ): Promise<string[]> {
    const user = await this.db.get<{
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
      detective_finds: number;
    }>('SELECT * FROM users WHERE user_id = $1', [userId]);
    if (!user) return [];

    const n = (v: unknown): number => {
      const x = typeof v === 'string' ? parseInt(v, 10) : (v as number);
      return Number.isFinite(x) ? (x as number) : 0;
    };

    const xpGain = opts.won ? 50 : 15;
    let level = n(user.level);
    let xp = n(user.xp) + xpGain;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level++;
    }

    const streak = opts.won ? n(user.current_streak) + 1 : 0;
    const games = n(user.games) + 1;
    const wins = n(user.wins) + (opts.won ? 1 : 0);
    const coins = n(user.coins) + (opts.won ? 25 : 5);
    const reputation = n(user.reputation) + (opts.won ? 12 : -4);

    await this.db.run(
      `UPDATE users SET level=$1, xp=$2, coins=$3, reputation=$4, games=$5, wins=$6,
         mafia_wins=$7, town_wins=$8, independent_wins=$9, best_streak=$10,
         current_streak=$11, games_survived=$12, detective_finds=$13
       WHERE user_id=$14`,
      [
        level,
        xp,
        coins,
        reputation,
        games,
        wins,
        n(user.mafia_wins) + (opts.won && opts.team === 'MAFIA' ? 1 : 0),
        n(user.town_wins) + (opts.won && opts.team === 'TOWN' ? 1 : 0),
        n(user.independent_wins) + (opts.won && opts.team === 'INDEPENDENT' ? 1 : 0),
        Math.max(n(user.best_streak), streak),
        streak,
        n(user.games_survived) + (opts.survived ? 1 : 0),
        n(user.detective_finds),
        userId,
      ],
    );

    // achievements granted from recorded stats
    const unlocked: string[] = [];
    const checks: [string, boolean][] = [
      ['FIRST_BLOOD', wins >= 1],
      ['SHADOW', n(user.mafia_wins) + (opts.won && opts.team === 'MAFIA' ? 1 : 0) >= 5],
      ['SURVIVOR', n(user.games_survived) + (opts.survived ? 1 : 0) >= 10],
      ['VETERAN', games >= 25],
      ['LAST_STANDING', opts.wonAsLastSurvivor],
    ];
    for (const [id, cond] of checks) {
      if (cond && (await this.maybeUnlock(userId, id))) unlocked.push(id);
    }
    return unlocked;
  }

  private async maybeUnlock(userId: number, id: string): Promise<boolean> {
    try {
      await this.db.run(
        `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1,$2,$3)`,
        [userId, id, Date.now()],
      );
      return true;
    } catch {
      return false; // already unlocked (PK conflict) — ignore
    }
  }
}

function playerTeam(role: RoleId): Team {
  if (isMafia(role)) return 'MAFIA';
  if (role === 'SERIAL_KILLER' || role === 'JESTER') return 'INDEPENDENT';
  return 'TOWN';
}

export function didPlayerWin(role: RoleId, winner: Team): boolean {
  return playerTeam(role) === winner;
}

export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 25;
}
