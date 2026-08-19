import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LedgerEntityDescriptionSkip1787400000000 implements MigrationInterface {
  name = 'LedgerEntityDescriptionSkip1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Why an entity was ruled out of the describe backlog for good. Nobody
    // plans "I need somewhere to host the repo" and means GitHub, so the
    // description would answer prose it should never match — and without the
    // ruling the same names come back to the top of the queue every sweep.
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        ADD COLUMN IF NOT EXISTS "descriptionSkipReason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "ledger_entity"
        DROP COLUMN IF EXISTS "descriptionSkipReason"
    `);
  }
}
