import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFreezesAvailableToUserStreak1784211327090
  implements MigrationInterface
{
  name = 'AddFreezesAvailableToUserStreak1784211327090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_streak"
      ADD "freezesAvailable" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_streak"
      DROP COLUMN "freezesAvailable"
    `);
  }
}
