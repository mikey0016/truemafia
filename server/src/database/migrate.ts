import type { Db } from './db.js';

/**
 * SQL written in the common subset of SQLite and PostgreSQL.
 * Uses IF NOT EXISTS (both support it for CREATE TABLE / CREATE INDEX).
 */
const MIGRATIONS: { id: number; name: string; sql: string[]; tolerateFailure?: boolean }[] = [
  {
    id: 1,
    name: 'users',
    sql: [
      `CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL,
        photo_url TEXT,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        coins INTEGER NOT NULL DEFAULT 100,
        reputation INTEGER NOT NULL DEFAULT 1000,
        games INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        mafia_wins INTEGER NOT NULL DEFAULT 0,
        town_wins INTEGER NOT NULL DEFAULT 0,
        independent_wins INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        games_survived INTEGER NOT NULL DEFAULT 0,
        last_seen_at BIGINT NOT NULL DEFAULT 0,
        is_banned INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_rating ON users (reputation DESC)`,
    ],
  },
  {
    id: 2,
    name: 'rooms',
    sql: [
      `CREATE TABLE IF NOT EXISTS rooms (
        id BIGSERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        host_id BIGINT NOT NULL,
        settings TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'LOBBY',
        demo_mode INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL,
        closed_at BIGINT
      )`,
    ],
  },
  {
    id: 3,
    name: 'room_players',
    sql: [
      `CREATE TABLE IF NOT EXISTS room_players (
        room_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        is_host INTEGER NOT NULL DEFAULT 0,
        is_bot INTEGER NOT NULL DEFAULT 0,
        ready INTEGER NOT NULL DEFAULT 0,
        seat INTEGER NOT NULL DEFAULT 0,
        joined_at BIGINT NOT NULL,
        PRIMARY KEY (room_id, user_id)
      )`,
    ],
  },
  {
    id: 4,
    name: 'games',
    sql: [
      `CREATE TABLE IF NOT EXISTS games (
        id BIGSERIAL PRIMARY KEY,
        room_id BIGINT NOT NULL,
        round INTEGER NOT NULL DEFAULT 0,
        phase TEXT NOT NULL DEFAULT 'LOBBY',
        settings TEXT NOT NULL,
        winner TEXT,
        started_at BIGINT,
        finished_at BIGINT,
        duration_ms BIGINT
      )`,
    ],
  },
  {
    id: 5,
    name: 'game_players',
    sql: [
      `CREATE TABLE IF NOT EXISTS game_players (
        game_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        alive INTEGER NOT NULL DEFAULT 1,
        is_bot INTEGER NOT NULL DEFAULT 0,
        killed_in_round INTEGER,
        death_cause TEXT,
        PRIMARY KEY (game_id, user_id)
      )`,
    ],
  },
  {
    id: 6,
    name: 'actions and votes',
    sql: [
      `CREATE TABLE IF NOT EXISTS actions (
        id BIGSERIAL PRIMARY KEY,
        game_id BIGINT NOT NULL,
        round INTEGER NOT NULL,
        actor_id BIGINT NOT NULL,
        kind TEXT NOT NULL,
        target_id BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_actions_game ON actions (game_id, round)`,
      `CREATE TABLE IF NOT EXISTS votes (
        id BIGSERIAL PRIMARY KEY,
        game_id BIGINT NOT NULL,
        round INTEGER NOT NULL,
        voter_id BIGINT NOT NULL,
        target_id BIGINT NOT NULL,
        created_at BIGINT NOT NULL,
        UNIQUE (game_id, round, voter_id)
      )`,
    ],
  },
  {
    id: 7,
    name: 'messages',
    sql: [
      `CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        game_id BIGINT NOT NULL,
        channel TEXT NOT NULL,
        sender_id BIGINT NOT NULL,
        sender_name TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_messages_game ON messages (game_id, channel)`,
    ],
  },
  {
    id: 8,
    name: 'achievements',
    sql: [
      `CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_achievements (
        user_id BIGINT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, achievement_id)
      )`,
    ],
  },
  {
    id: 9,
    name: 'reports',
    sql: [
      `CREATE TABLE IF NOT EXISTS reports (
        id BIGSERIAL PRIMARY KEY,
        reporter_id BIGINT NOT NULL,
        reported_id BIGINT NOT NULL,
        reason TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )`,
    ],
  },
  {
    id: 10,
    name: 'users_detective_finds',
    // ALTER TABLE ADD COLUMN fails when the column already exists; tolerated below.
    tolerateFailure: true,
    sql: [`ALTER TABLE users ADD COLUMN detective_finds INTEGER NOT NULL DEFAULT 0`],
  },
  {
    id: 11,
    name: 'purchases',
    sql: [
      `CREATE TABLE IF NOT EXISTS purchases (
        user_id BIGINT NOT NULL,
        item_id TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, item_id)
      )`,
    ],
  },
  {
    id: 12,
    name: 'users_active_frame',
    tolerateFailure: true,
    sql: [`ALTER TABLE users ADD COLUMN active_frame TEXT`],
  },
  {
    id: 13,
    name: 'users_active_title',
    tolerateFailure: true,
    sql: [`ALTER TABLE users ADD COLUMN active_title TEXT`],
  },
];

export async function migrate(db: Db): Promise<void> {
  // common subset: works on both engines
  const pg = db.kind === 'postgres';
  // BIGSERIAL is PG-only; SQLite uses INTEGER PRIMARY KEY (autoincrement behavior on rowid)
  for (const m of MIGRATIONS) {
    for (let sql of m.sql) {
      if (pg) {
        sql = sql.replace(/TEXT/g, 'TEXT');
      } else {
        sql = sql.replace(/\bBIGSERIAL\b/g, 'INTEGER');
      }
      try {
        await db.run(sql);
      } catch (err) {
        if (m.tolerateFailure) continue; // e.g. column already exists
        throw err;
      }
    }
  }
}
