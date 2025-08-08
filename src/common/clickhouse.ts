import { createClient } from '@clickhouse/client';

let client: ReturnType<typeof createClient> | null = null;

export const getClickHouseClient = () => {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL || 'http://host.docker.internal:18123',
      password: process.env.CLICKHOUSE_PASSWORD || 'changeme',
    });
  }

  return client;
};
