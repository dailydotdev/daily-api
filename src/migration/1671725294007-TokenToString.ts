import { MigrationInterface, QueryRunner } from 'typeorm';

export class TokenToString1671725294007 implements MigrationInterface {
  name = 'TokenToString1671725294007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_referralToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_member" DROP COLUMN "referralToken"`,
    );
    await queryRunner.query(`ALTER TABLE "source_member"
      ADD "referralToken" text NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_source_member_referralToken" ON "source_member" ("referralToken") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_referralToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_member" DROP COLUMN "referralToken"`,
    );
    await queryRunner.query(`ALTER TABLE "source_member"
      ADD "referralToken" uuid NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_source_member_referralToken" ON "source_member" ("referralToken") `,
    );
  }
}
