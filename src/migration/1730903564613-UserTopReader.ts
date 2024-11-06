import { MigrationInterface, QueryRunner } from "typeorm";

export class UserTopReader1730903564613 implements MigrationInterface {
  name = 'UserTopReader1730903564613'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_post_keyword_status" ON "post_keyword" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_post_keyword_status"`);
  }
}
