import { NativeConnection } from '@temporalio/worker';
import { TEMPORAL_ADDRESS } from './config';

let connection: NativeConnection;

export const getTemporalWorkerConnection = async () => {
  if (connection) {
    return connection;
  }

  const con = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  connection = con;

  return con;
};
