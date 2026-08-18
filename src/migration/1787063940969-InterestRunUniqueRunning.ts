import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InterestRunUniqueRunning1787063940969
  implements MigrationInterface
{
  name = 'InterestRunUniqueRunning1787063940969';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_interest_run_interest_id_running"
        ON "interest_run" ("interestId")
        WHERE status = 'running'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_interest_run_interest_id_running"
    `);
  }
}
