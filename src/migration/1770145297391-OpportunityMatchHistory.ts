import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpportunityMatchHistory1770145297391 implements MigrationInterface {
  name = 'OpportunityMatchHistory1770145297391';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity_match" ADD "history" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity_match" DROP COLUMN "history"`,
    );
  }
}
