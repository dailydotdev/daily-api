import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimSignaturesBackfilledAt1787500000000
  implements MigrationInterface
{
  name = 'ClaimSignaturesBackfilledAt1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Two empty signature arrays are a real answer for a claim with no code
    // surface, so an unprocessed claim is indistinguishable from a processed
    // one without this. It is what makes the backfill resumable, and what lets
    // a later reader tell "nothing there" from "never looked".
    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        ADD COLUMN IF NOT EXISTS "signaturesBackfilledAt" TIMESTAMP
    `);

    // The backfill's own work queue: claims it has not reached yet, newest
    // first. Partial so the index stays small as the column fills in.
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_signatures_backfill_pending"
        ON "claim" ("changeType")
        WHERE "signaturesBackfilledAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_signatures_backfill_pending"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        DROP COLUMN IF EXISTS "signaturesBackfilledAt"
    `);
  }
}
