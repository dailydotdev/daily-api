import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEmailIndex1722942338711 implements MigrationInterface {
  name = 'UserEmailIndex1722942338711'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_user_loweremail" ON "user" ((lower(email)))`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
    await queryRunner.query(`DROP INDEX "public"."user_email_index"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_user_email" ON "user" ("email") `);
    await queryRunner.query(`CREATE INDEX "user_email_index" ON "user" ("email") `);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_loweremail"`);
  }
}
