declare module 'pg' {
  export interface PoolConfig {
    connectionString?: string;
  }
  export interface QueryResult {
    rows: Record<string, unknown>[];
  }
  export class Pool {
    constructor(config?: PoolConfig | string);
    query(sql: string, params?: unknown[]): Promise<QueryResult>;
    end(): Promise<void>;
  }
}
