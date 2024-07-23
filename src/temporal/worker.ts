import { NativeConnection } from '@temporalio/worker';
import { getTemporalServerOptions } from './config';
import { logger } from '../logger';

let connection: NativeConnection;

export const getTemporalWorkerConnection = async () => {
  if (connection) {
    return connection;
  }

  try {
    const { tls, address } = getTemporalServerOptions();

    connection = await NativeConnection.connect({ address, tls });

    return connection;
  } catch (error) {
    logger.error(error, 'failed connecting to server');
  }
};
