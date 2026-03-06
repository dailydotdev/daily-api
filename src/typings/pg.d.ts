declare module 'pg' {
  export class PoolClient {
    query(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
    release(): void;
  }

  export class Pool {
    constructor(config?: {
      host?: string;
      port?: number;
      user?: string;
      password?: string;
      database?: string;
      max?: number;
    });
    query(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
