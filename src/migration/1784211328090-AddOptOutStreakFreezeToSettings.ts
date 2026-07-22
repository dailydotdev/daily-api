import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptOutStreakFreezeToSettings1784211328090
  implements MigrationInterface
{
  name = 'AddOptOutStreakFreezeToSettings1784211328090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "settings"
      ADD "optOutStreakFreeze" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "settings"
      DROP COLUMN "optOutStreakFreeze"
    `);
  }
}
