import { DataSource, QueryRunner } from 'typeorm';
import { queryDataSource } from './queryDataSource';

export const queryReadReplica = async <T>(
  con: DataSource,
  callback: ({ queryRunner }: { queryRunner: QueryRunner }) => Promise<T>,
): Promise<T> => {
  return queryDataSource(con, callback, {
    mode: Math.random() < 0.5 ? 'slave' : 'master',
  });
};
