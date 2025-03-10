import { MigrationInterface, QueryRunner } from 'typeorm';

export class AwardComment1741621921297 implements MigrationInterface {
  name = 'AwardComment1741621921297';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_comment" ADD "awardTransactionId" uuid`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7367f5d051b455522b6e823e1" ON "user_comment" ("awardTransactionId") `,
    );

    await queryRunner.query(
      `ALTER TABLE "user_comment" ADD CONSTRAINT "FK_a7367f5d051b455522b6e823e18" FOREIGN KEY ("awardTransactionId") REFERENCES "user_transaction"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "comment" ADD "awardTransactionId" uuid`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c98641708e2e18b2f842c2bd15" ON "comment" ("awardTransactionId") `,
    );

    await queryRunner.query(
      `ALTER TABLE "comment" ADD CONSTRAINT "FK_c98641708e2e18b2f842c2bd153" FOREIGN KEY ("awardTransactionId") REFERENCES "user_transaction"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comment" DROP CONSTRAINT "FK_c98641708e2e18b2f842c2bd153"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_c98641708e2e18b2f842c2bd15"`);

    await queryRunner.query(
      `ALTER TABLE "comment" DROP COLUMN "awardTransactionId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_comment" DROP CONSTRAINT "FK_a7367f5d051b455522b6e823e18"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_a7367f5d051b455522b6e823e1"`);

    await queryRunner.query(
      `ALTER TABLE "user_comment" DROP COLUMN "awardTransactionId"`,
    );
  }
}
