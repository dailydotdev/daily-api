import { MigrationInterface, QueryRunner } from 'typeorm';

export class OpportunitySubscriptionFlags1765378734870
  implements MigrationInterface
{
  name = 'OpportunitySubscriptionFlags1765378734870';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity" ADD "subscriptionFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity" DROP COLUMN "subscriptionFlags"`,
    );
  }
}
