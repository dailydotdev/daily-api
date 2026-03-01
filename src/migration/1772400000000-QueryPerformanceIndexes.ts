import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QueryPerformanceIndexes1772400000000
  implements MigrationInterface
{
  name = 'QueryPerformanceIndexes1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_user_marketing_cta_userId_readAt_null"
      ON "user_marketing_cta" ("userId")
      WHERE "readAt" IS NULL
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_view_userId_postId_timestamp_desc"
      ON "view" ("userId", "postId", "timestamp" DESC)
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_post_relation_relatedPostId_createdAt"
      ON "post_relation" ("relatedPostId", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_source_gin_name"
      ON "source" USING GIN ("name" gin_trgm_ops)
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_source_gin_handle"
      ON "source" USING GIN ("handle" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_source_gin_handle"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_source_gin_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_post_relation_relatedPostId_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_view_userId_postId_timestamp_desc"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_user_marketing_cta_userId_readAt_null"`,
    );
  }
}
