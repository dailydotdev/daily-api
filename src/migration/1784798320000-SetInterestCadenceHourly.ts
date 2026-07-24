import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SetInterestCadenceHourly1784798320000 implements MigrationInterface {
  name = 'SetInterestCadenceHourly1784798320000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
        ALTER COLUMN "cadence" SET DEFAULT 'hourly'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
        ALTER COLUMN "cadence" DROP DEFAULT
    `);
  }
}
