import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InterestAgentUx1787227592879 implements MigrationInterface {
  name = 'InterestAgentUx1787227592879';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
      ADD "title" text
    `);
    await queryRunner.query(/* sql */ `
      ALTER TABLE "interest_run"
      ADD "progress" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "interest_run"
      DROP COLUMN "progress"
    `);
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
      DROP COLUMN "title"
    `);
  }
}
