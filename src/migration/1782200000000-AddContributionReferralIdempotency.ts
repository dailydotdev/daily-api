import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContributionReferralIdempotency1782200000000
  implements MigrationInterface
{
  name = 'AddContributionReferralIdempotency1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guarantees a referrer is credited at most once per referee, even if the
    // activation event is redelivered. Partial so it only applies to
    // referral-award submissions (those carrying a refereeId flag).
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_contribution_submission_referee"
        ON "contribution_submission" ("actionId", (("flags" ->> 'refereeId')))
        WHERE ("flags" ->> 'refereeId') IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_contribution_submission_referee"
    `);
  }
}
