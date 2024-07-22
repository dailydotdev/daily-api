import { Client } from '@temporalio/client';
import { Connection as TemporalConnection } from '@temporalio/client/lib/connection';
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE } from './config';

let client: Client;

export const getTemporalClient = async (): Promise<Client> => {
  if (client) {
    return client;
  }

  const connection = await TemporalConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

  return client;
};
