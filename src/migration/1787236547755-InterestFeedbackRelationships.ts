import { MigrationInterface, QueryRunner } from 'typeorm';

export class InterestFeedbackRelationships1787236547755
  implements MigrationInterface
{
  name = 'InterestFeedbackRelationships1787236547755';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "interest_feedback"
      ADD "relationships" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "interest_feedback"
      DROP COLUMN "relationships"
    `);
  }
}
