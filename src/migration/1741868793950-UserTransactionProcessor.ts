import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTransactionProcessor1741868793950
  implements MigrationInterface
{
  name = 'UserTransactionPaddleFlags1741868793950';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD "processor" text NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP COLUMN "processor"`,
    );
  }
}
