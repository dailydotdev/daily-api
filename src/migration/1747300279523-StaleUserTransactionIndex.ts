import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaleUserTransactionIndex1747300279523
  implements MigrationInterface
{
  name = 'StaleUserTransactionIndex1747300279523';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_status_updated_at" ON user_transaction ("status", "updatedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_status_updated_at"`,
    );
  }
}
