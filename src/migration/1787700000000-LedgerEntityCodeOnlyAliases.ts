import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerEntityCodeOnlyAliases1787700000000
  implements MigrationInterface
{
  name = 'LedgerEntityCodeOnlyAliases1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Registry names that double as ordinary English words (`requests`,
    // `next`). They answer name lookups like aliases; prose matching in the
    // rot detector never sees them.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "codeOnlyAliases" text array NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(/* sql */ `
      CREATE OR REPLACE FUNCTION ledger_entity_search_names("canonicalName" text, "aliases" text[], "codeOnlyAliases" text[])
        RETURNS text[]
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
      AS $$
        SELECT array_agg(DISTINCT lower("name"))
          FROM unnest(array_prepend("canonicalName", "aliases" || "codeOnlyAliases")) AS "name"
      $$
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_ledger_entity_search_names"
    `);

    // The 2-arg form would silently miss code-only names in the uniqueness
    // guard, so it is dropped rather than left behind as a wrong answer.
    await queryRunner.query(/* sql */ `
      DROP FUNCTION IF EXISTS ledger_entity_search_names(text, text[])
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_ledger_entity_search_names"
        ON "ledger_entity"
        USING GIN (ledger_entity_search_names("canonicalName", "aliases", "codeOnlyAliases"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_ledger_entity_search_names"
    `);

    await queryRunner.query(/* sql */ `
      DROP FUNCTION IF EXISTS ledger_entity_search_names(text, text[], text[])
    `);

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
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "codeOnlyAliases"
    `);
  }
}
