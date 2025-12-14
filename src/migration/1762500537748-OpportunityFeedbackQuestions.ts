import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpportunityFeedbackQuestions1762500537748
  implements MigrationInterface
{
  name = 'OpportunityFeedbackQuestions1762500537748';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity_match" ADD "feedback" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity_match" DROP COLUMN "feedback"`,
    );
  }
}
