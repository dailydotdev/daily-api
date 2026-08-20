import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaimSignatureNorm1787600000000 implements MigrationInterface {
  name = 'ClaimSignatureNorm1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A plan spells a signature the way its code does, so the lookup is by
    // lowercased token. The plain-array GIN indexes only serve case-sensitive
    // &&, and an expression index needs an immutable expression, so the
    // normalization gets a function, mirroring ledger_entity_search_names.
    await queryRunner.query(/* sql */ `
      CREATE OR REPLACE FUNCTION ledger_signature_norm("signatures" text[])
        RETURNS text[]
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
      AS $$
        SELECT array_agg(DISTINCT lower("signature"))
          FROM unnest("signatures") AS "signature"
      $$
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_affected_norm"
        ON "claim"
        USING GIN (ledger_signature_norm("affected"))
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_claim_superseding_norm"
        ON "claim"
        USING GIN (ledger_signature_norm("superseding"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_superseding_norm"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_claim_affected_norm"
    `);

    await queryRunner.query(/* sql */ `
      DROP FUNCTION IF EXISTS ledger_signature_norm(text[])
    `);
  }
}
