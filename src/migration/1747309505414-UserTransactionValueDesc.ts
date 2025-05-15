import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTransactionValueDesc1747309505414
  implements MigrationInterface
{
  name = 'UserTransactionValueDesc1747309505414';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_value_desc" ON user_transaction ("value" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_value_desc"`,
    );
  }
}
