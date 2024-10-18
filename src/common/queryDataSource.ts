import { DataSource, QueryRunner, ReplicationMode } from 'typeorm';

export const queryDataSource = async <T>(
  con: DataSource,
  callback: ({ queryRunner }: { queryRunner: QueryRunner }) => Promise<T>,
  options?: Partial<{
    mode: ReplicationMode;
  }>,
): Promise<T> => {
  const queryRunner = con.createQueryRunner(options?.mode || 'master');
  const result = await callback({ queryRunner });
  await queryRunner.release();
  return result;
};
