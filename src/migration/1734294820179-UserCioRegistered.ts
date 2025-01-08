import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCioRegistered1734294820179 implements MigrationInterface {
  name = 'UserCioRegistered1734294820179';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "cioRegistered" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_cioRegistered" ON "user" ("cioRegistered") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_cioRegistered"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "cioRegistered"`);
  }
}
