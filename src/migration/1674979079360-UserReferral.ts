import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserReferral1674979079360 implements MigrationInterface {
  name = 'UserReferral1674979079360';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referral"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "referralId" character varying(36)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_referral" ON "user" ("referralId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_ab57b9b261d32985dab19184382" FOREIGN KEY ("referralId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_ab57b9b261d32985dab19184382"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_referral"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "referralId"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "referral" text`);
  }
}
