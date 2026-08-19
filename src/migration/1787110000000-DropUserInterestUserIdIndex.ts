import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserInterestUserIdIndex1787110000000
  implements MigrationInterface
{
  name = 'DropUserInterestUserIdIndex1787110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_user_interest_user_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_interest_user_id"
        ON "user_interest" ("userId")
    `);
  }
}
