import { createClient } from '@clickhouse/client';

let client: ReturnType<typeof createClient> | null = null;

export const getClickHouseClient = () => {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
    });
  }

  return client;
};
