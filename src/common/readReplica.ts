import { DataSource, QueryRunner } from 'typeorm';

export const readReplica = async <T>(
  con: DataSource,
  callback: ({ queryRunner }: { queryRunner: QueryRunner }) => Promise<T>,
): Promise<T> => {
  const queryRunner = con.createQueryRunner('slave');
  const result = await callback({ queryRunner });
  await queryRunner.release();
  return result;
};
