import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserTransactionReferenceId1749033985082
  implements MigrationInterface
{
  name = 'UserTransactionReferenceId1749033985082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD "referenceType" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" ADD "referenceId" text`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_referenceId" ON "user_transaction" ("referenceId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP COLUMN "referenceType"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_user_transaction_referenceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_transaction" DROP COLUMN "referenceId"`,
    );
  }
}
