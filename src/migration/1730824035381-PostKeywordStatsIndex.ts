import { MigrationInterface, QueryRunner } from "typeorm";

export class PostKeywordStatsIndex1730824035381 implements MigrationInterface {
  name = 'PostKeywordStatsIndex1730824035381'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_post_keyword_status" ON post_keyword ( status )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_keyword_status"`);
  }
}
