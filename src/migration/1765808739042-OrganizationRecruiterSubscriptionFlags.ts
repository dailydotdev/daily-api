import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationRecruiterSubscriptionFlags1765808739042
  implements MigrationInterface
{
  name = 'OrganizationRecruiterSubscriptionFlags1765808739042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "opportunity" DROP COLUMN "subscriptionFlags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization" ADD "recruiterSubscriptionFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization" DROP COLUMN "recruiterSubscriptionFlags"`,
    );
    await queryRunner.query(
      `ALTER TABLE "opportunity" ADD "subscriptionFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }
}
