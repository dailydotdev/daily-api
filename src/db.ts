import { AppDataSource } from './data-source';
import { DataSource } from 'typeorm';

let connection: DataSource;

const createOrGetConnection = async () => {
  if (!connection) {
    connection = await AppDataSource.initialize();
  }
  return connection;
};

export default createOrGetConnection;
