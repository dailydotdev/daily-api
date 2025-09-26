import { createClient } from '@clickhouse/client';

let client: ReturnType<typeof createClient> | null = null;

export const getClickHouseClient = () => {
  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
      request_timeout: 90_000,
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
