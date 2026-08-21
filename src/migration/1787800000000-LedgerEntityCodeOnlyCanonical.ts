import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerEntityCodeOnlyCanonical1787800000000
  implements MigrationInterface
{
  name = 'LedgerEntityCodeOnlyCanonical1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The codeOnlyAliases ruling, for the canonical name itself: `Go`, `Bun`
    // and `Wine` are ordinary English words before they are anything else. The
    // name still answers every lookup, so the search-names function and its
    // index are deliberately untouched — only prose matching reads this.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "codeOnlyCanonical" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "codeOnlyCanonical"
    `);
  }
}
