import { NativeConnection } from '@temporalio/worker';
import { getTemporalServerOptions } from './config';

let connection: NativeConnection;

export const getTemporalWorkerConnection = async () => {
  if (connection) {
    return connection;
  }

  const { tls, address } = getTemporalServerOptions();

  connection = await NativeConnection.connect({ address, tls });

  return connection;
};
