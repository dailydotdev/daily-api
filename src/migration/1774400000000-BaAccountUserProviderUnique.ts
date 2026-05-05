import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BaAccountUserProviderUnique1774400000000 implements MigrationInterface {
  name = 'BaAccountUserProviderUnique1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS
        "IDX_ba_account_userId_providerId"
        ON "ba_account" ("userId", "providerId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_ba_account_userId_providerId"
    `);
  }
}
