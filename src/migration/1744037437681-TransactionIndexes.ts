import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionIndexes1744037437681 implements MigrationInterface {
  name = 'TransactionIndexes1744037437681';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_receiverId_senderId_productId_status" ON user_transaction ("receiverId", "senderId", "productId", "status")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_productId" ON user_transaction ("productId")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_senderId" ON user_transaction ("senderId")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_receiverId" ON user_transaction ("receiverId")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_status" ON user_transaction ("status")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_user_transaction_createdAt_desc" ON user_transaction ("createdAt" DESC)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_product_type" ON product ("type")`,
    );

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_comment_flags_awardId" ON "comment" (("flags"->>'awardId'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_comment_flags_awardId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_product_type"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_createdAt_desc"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_status"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_receiverId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_senderId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_productId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_user_transaction_receiverId_senderId_productId_status"`,
    );
  }
}
