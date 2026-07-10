import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds an index on ba_account (accountId, providerId) to back better-auth's
 * account lookup `WHERE accountId = $1 AND providerId = $2`, which was
 * sequentially scanning the ~1.8M-row table (14M+ seq scans, accountId is
 * effectively unique). Created live in production on 2026-06-22; this migration
 * syncs the schema for other environments. CREATE INDEX (no CONCURRENTLY) is
 * fine here since migrations run in a transaction; IF NOT EXISTS makes it a
 * no-op where the index already exists.
 */
export class AddBaAccountAccountIdIndex1782400000000
  implements MigrationInterface
{
  name = 'AddBaAccountAccountIdIndex1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_ba_account_accountId_providerId"
        ON "ba_account" ("accountId", "providerId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "public"."IDX_ba_account_accountId_providerId";
    `);
  }
}
