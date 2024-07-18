import { Client } from '@temporalio/client';
import { Connection as TemporalConnection } from '@temporalio/client/lib/connection';

const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

let client: Client;

export const getTemporalClient = async (): Promise<Client> => {
  if (client) {
    return client;
  }

  const connection = await TemporalConnection.connect({
    address: 'host.docker.internal:7233',
  });

  client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

  return client;
};
