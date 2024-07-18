import { Client } from '@temporalio/client';
import { Connection as TemporalConnection } from '@temporalio/client/lib/connection';

const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

export const getTemporalClient = async (): Promise<Client> => {
  const connection = await TemporalConnection.connect({
    address: 'host.docker.internal:7233',
  });

  return new Client({ connection, namespace: TEMPORAL_NAMESPACE });
};
