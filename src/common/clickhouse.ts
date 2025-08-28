import { createClient } from '@clickhouse/client';

let client: ReturnType<typeof createClient> | null = null;

export const getClickHouseClient = () => {
  if (!client) {
    client = createClient({
      url: 'http://localhost:18123',
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
    });
  }

  return client;
};

export const closeClickHouseClient = async () => {
  if (client) {
    await client.close();

    client = null;
  }
};
