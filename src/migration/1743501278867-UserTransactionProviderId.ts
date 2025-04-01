import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTransactionProviderId1743501278867
  implements MigrationInterface
{
  name = 'UserTransactionProviderId1743501278867';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_transaction_flags_providerId"
        ON "user_transaction" (("flags"->>'providerId'));
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_transaction_flags_providerId";`,
    );
  }
}
