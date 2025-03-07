import { MigrationInterface, QueryRunner } from 'typeorm';

export class AwardPost1741184461161 implements MigrationInterface {
  name = 'AwardPost1741184461161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_post" ADD "awardTransactionId" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_post" ADD CONSTRAINT "FK_08b324c354feec664de3048da87" FOREIGN KEY ("awardTransactionId") REFERENCES "user_transaction"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_08b324c354feec664de3048da8" ON "user_post" ("awardTransactionId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_08b324c354feec664de3048da8"`);

    await queryRunner.query(
      `ALTER TABLE "user_post" DROP CONSTRAINT "FK_08b324c354feec664de3048da87"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_post" DROP COLUMN "awardTransactionId"`,
    );
  }
}
