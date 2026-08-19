import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimLookupIndex1787200000000 implements MigrationInterface {
  name = 'ClaimLookupIndex1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE EXTENSION IF NOT EXISTS pg_trgm
    `);

    // A plan names things the way code does, so the lookup is by lowercased
    // name. The equivalent inline predicate cannot use an index, and an index
    // needs an immutable expression, so the normalization gets a function.
    await queryRunner.query(/* sql */ `
      CREATE OR REPLACE FUNCTION ledger_entity_search_names("canonicalName" text, "aliases" text[])
        RETURNS text[]
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
      AS $$
        SELECT array_agg(DISTINCT lower("name"))
          FROM unnest(array_prepend("canonicalName", "aliases")) AS "name"
      $$
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entity_search_names"
        ON "ledger_entity"
        USING GIN (ledger_entity_search_names("canonicalName", "aliases"))
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_ledger_entity_aliases"
    `);

    // Near-miss matching for a name the plan spells differently than the
    // ledger does, once the exact lookup comes back empty.
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entity_canonical_name_trgm"
        ON "ledger_entity"
        USING GIN (lower("canonicalName") gin_trgm_ops)
    `);

    // Which symbols a change makes stale, and which ones replace them. Matching
    // the statement text instead would flag the replacement it names as rot.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        ADD COLUMN IF NOT EXISTS "affected" text array NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        ADD COLUMN IF NOT EXISTS "superseding" text array NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_affected"
        ON "claim"
        USING GIN ("affected")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_superseding"
        ON "claim"
        USING GIN ("superseding")
    `);

    // The raw extraction's own signatures, so a re-run can refile them without
    // going through a reviewer.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim_candidate"
        ADD COLUMN IF NOT EXISTS "affected" text array NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim_candidate"
        ADD COLUMN IF NOT EXISTS "superseding" text array NOT NULL DEFAULT '{}'
    `);

    // Semver, calver and bare-integer versions are all dot-separated numeric
    // tuples, which int[] compares element-wise, so one derived column answers
    // "is the version in the plan inside this claim's scope" for every scheme.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        ADD COLUMN IF NOT EXISTS "versionParsed" int array
        GENERATED ALWAYS AS (
          string_to_array((regexp_match("versionScope", '([0-9]+(?:\\.[0-9]+)*)'))[1], '.')::int[]
        ) STORED
    `);

    // An extracted date is the change's own; anything recovered from evidence
    // is only an upper bound on it, and a month window has to tell them apart.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        ADD COLUMN IF NOT EXISTS "dateSource" text
    `);

    await queryRunner.query(/* sql */ `
      UPDATE "claim"
        SET "dateSource" = 'extracted'
        WHERE "effectiveDate" IS NOT NULL
          AND "dateSource" IS NULL
    `);

    // Counting changes per month across the ledger reads no entity, so the
    // existing index cannot serve it.
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_changeType_effectiveDate"
        ON "claim" ("changeType", "effectiveDate")
    `);

    // Both are declared ON DELETE SET NULL, so every delete scans the table
    // without them.
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_supersededByClaimId"
        ON "claim" ("supersededByClaimId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_supersededByEntityId"
        ON "claim" ("supersededByEntityId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_candidate_claimId"
        ON "claim_candidate" ("claimId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_candidate_claimId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_supersededByEntityId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_supersededByClaimId"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_changeType_effectiveDate"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        DROP COLUMN IF EXISTS "dateSource"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        DROP COLUMN IF EXISTS "versionParsed"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim_candidate"
        DROP COLUMN IF EXISTS "superseding"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim_candidate"
        DROP COLUMN IF EXISTS "affected"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        DROP COLUMN IF EXISTS "superseding"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "claim"
        DROP COLUMN IF EXISTS "affected"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_ledger_entity_canonical_name_trgm"
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entity_aliases"
        ON "ledger_entity"
        USING GIN ("aliases")
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_ledger_entity_search_names"
    `);

    await queryRunner.query(/* sql */ `
      DROP FUNCTION IF EXISTS ledger_entity_search_names(text, text[])
    `);
  }
}
