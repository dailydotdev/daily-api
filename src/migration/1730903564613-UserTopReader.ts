import { MigrationInterface, QueryRunner } from "typeorm";

export class UserTopReader1730903564613 implements MigrationInterface {
  name = 'UserTopReader1730903564613'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_post_keyword_status" ON "post_keyword" ("status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_top_reader_userId_issuedAt_keywordValue" ON "user_top_reader" ("userId", "issuedAt", "keywordValue") `);
    await queryRunner.query(`ALTER TABLE "public"."user_top_reader" REPLICA IDENTITY FULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."user_top_reader" REPLICA IDENTITY DEFAULT`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_top_reader_userId_issuedAt_keywordValue"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_post_keyword_status"`);
  }
}
