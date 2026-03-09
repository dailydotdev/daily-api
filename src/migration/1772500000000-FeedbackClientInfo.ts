import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackClientInfo1772500000000 implements MigrationInterface {
  name = 'FeedbackClientInfo1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "feedback"
      ADD COLUMN "clientInfo" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "feedback"
      DROP COLUMN "clientInfo"
    `);
  }
}
