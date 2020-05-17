import {
  Connection,
  createConnection,
  getConnection,
  getConnectionManager,
} from 'typeorm';

export const createOrGetConnection = (): Promise<Connection> =>
  getConnectionManager().has('default')
    ? Promise.resolve(getConnection())
    : createConnection();
