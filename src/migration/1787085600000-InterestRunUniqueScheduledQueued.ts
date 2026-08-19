import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InterestRunUniqueScheduledQueued1787085600000
  implements MigrationInterface
{
  name = 'InterestRunUniqueScheduledQueued1787085600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_interest_run_interest_id_scheduled_queued"
        ON "interest_run" ("interestId")
        WHERE status = 'queued' AND trigger = 'scheduled'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_interest_run_interest_id_scheduled_queued"
    `);
  }
}
