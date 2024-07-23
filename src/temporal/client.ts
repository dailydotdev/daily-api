import { Client } from '@temporalio/client';
import { Connection as TemporalConnection } from '@temporalio/client/lib/connection';
import { getTemporalServerOptions } from './config';
import { logger } from '../logger';

let client: Client;

export const getTemporalClient = async (): Promise<Client> => {
  if (client) {
    return client;
  }

  try {
    const { namespace, tls, address } = getTemporalServerOptions();
    const connection = await TemporalConnection.connect({ tls, address });

    client = new Client({ connection, namespace });

    return client;
  } catch (error) {
    logger.error(error, 'failed creating client connection');
  }
};
