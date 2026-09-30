import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export interface QueryResult {
  rows: Record<string, unknown>[];
}

/**
 * Normalized query interface used by the rest of the server.
 * SQL is written in the common subset of SQLite and PostgreSQL
 * ($1..$n positional params, RETURNING).
 */
export interface Db {
  kind: 'sqlite' | 'postgres';
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<QueryResult>;
  close(): void;
}

export async function createDb(fileOverride?: string): Promise<Db> {
  const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();
  if (client === 'postgres') return createPostgres();
  return createSqlite(fileOverride || process.env.DATABASE_URL || './data/true-mafia.sqlite');
}

/**
 * SQLite via Node's built-in `node:sqlite` (Node >= 22.5, stable in 24+).
 * Zero native build dependencies - works out of the box on Windows/Linux/macOS.
 */
function createSqlite(file: string): Db {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new DatabaseSync(file);

  const run = (sql: string, params: unknown[] = []): QueryResult => {
    const q = sql.replace(/\$\d+/g, '?');
    const isRead = /^\s*(select|with)/i.test(q);
    // node:sqlite only returns rows from .all()/.get(); INSERT ... RETURNING must go through .all()
    if (/\breturning\b/i.test(q)) {
      const rows = sqlite.prepare(q).all(...(params as never[])) as Record<string, unknown>[];
      return { rows };
    }
    if (isRead) {
      const rows = sqlite.prepare(q).all(...(params as never[])) as Record<string, unknown>[];
      return { rows };
    }
    const stmt = sqlite.prepare(q);
    stmt.run(...(params as never[]));
    return { rows: [] };
  };

  return {
    kind: 'sqlite',
    async all<T>(sql: string, params: unknown[] = []) {
      return run(sql, params).rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return run(sql, params).rows[0] as T | undefined;
    },
    async run(sql, params = []) {
      return run(sql, params);
    },
    close() {
      sqlite.close();
    },
  };
}

async function createPostgres(): Promise<Db> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/true_mafia',
  });
  return {
    kind: 'postgres',
    async all<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params);
      return res.rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params);
      return res.rows[0] as T | undefined;
    },
    async run(sql, params = []) {
      const res = await pool.query(sql, params);
      return { rows: res.rows as Record<string, unknown>[] };
    },
    close() {
      void pool.end();
    },
  };
}
