import { MigrationInterface, QueryRunner } from "typeorm";

export class UserStatsIndex1730860362949 implements MigrationInterface {
  name = 'UserStatsIndex1730860362949'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_stats_id" ON "public"."user_stats" ("id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_user_stats_id"`);
  }
}
