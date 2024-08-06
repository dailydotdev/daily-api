import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEmailIndex1722942338711 implements MigrationInterface {
  name = 'UserEmailIndex1722942338711'
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY "IDX_user_loweremail" ON "user" ((lower(email)));`,
    );
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "public"."user_email_index";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "user_email_index" ON "user" ("email");`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "public"."IDX_user_loweremail";`);
  }
}
