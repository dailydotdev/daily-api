import { MigrationInterface, QueryRunner } from 'typeorm';

export class KeywordIndexes1712910394483 implements MigrationInterface {
  name = 'KeywordIndexes1712910394483';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_post_sourceid_deleted" ON "post" ("sourceId", "deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_sourceid_createdat" ON "post" ("sourceId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_keyword_status_keyword_postid" ON "post_keyword" ("status", "keyword", "postId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_sourceid_createdat"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_post_sourceid_deleted"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_keyword_status_keyword_postid"`,
    );
  }
}
