import { AppDataSource } from './data-source';

const createOrGetConnection = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
};

export default createOrGetConnection;
