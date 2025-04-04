import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTransactionValueFee1743776947033
  implements MigrationInterface
{
  name = 'UserTransactionValueFee1743776947033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD COLUMN IF NOT EXISTS "valueIncFees" integer NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP COLUMN IF EXISTS "valueIncFees"`,
    );
  }
}
