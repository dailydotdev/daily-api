import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerEntityEcosystem1787900000000 implements MigrationInterface {
  name = 'LedgerEntityEcosystem1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The package registries an entity is installed from, as a closed
    // vocabulary held in `LedgerEcosystem`. Empty is UNKNOWN and matches
    // everything, so the default is the safe value and no row needs a backfill
    // before the column can be read: filling it can only remove matches.
    //
    // No index. Every read path reaches this column through an entity already
    // located by name or by id, and nothing filters or groups by it outside
    // `bin/backfillEntityEcosystems.ts`, whose own scan is a full pass by
    // design. A GIN index nothing queries is write amplification on every
    // entity write, so it is left out until a read path asks for it.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "ecosystem" text array NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "ecosystem"
    `);
  }
}
