import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectionClassificationToOpportunityMatch1770812936388
  implements MigrationInterface
{
  name = 'AddRejectionClassificationToOpportunityMatch1770812936388';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity_match"
       ADD COLUMN IF NOT EXISTS "rejectionClassification" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "opportunity_match"
       ALTER COLUMN "rejectionClassification" SET DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity_match"
       DROP COLUMN IF EXISTS "rejectionClassification"`,
    );
  }
}
