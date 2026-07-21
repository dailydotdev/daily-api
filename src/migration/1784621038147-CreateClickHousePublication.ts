import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClickHousePublication1784621038147 implements MigrationInterface {
  name = 'CreateClickHousePublication1784621038147';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP PUBLICATION IF EXISTS "clickhouse_sync"
    `);

    await queryRunner.query(/* sql */ `
      CREATE PUBLICATION "clickhouse_sync"
        FOR TABLE
          "public"."post",
          "public"."source",
          "public"."keyword",
          "public"."niche",
          "public"."keyword_niche",
          "public"."user",
          "public"."content_preference",
          "public"."post_keyword",
          "public"."post_niche",
          "public"."comment",
          "public"."campaign",
          "public"."post_relation",
          "public"."user_personalized_digest",
          "public"."user_company",
          "public"."highlights_canonical"
        WITH (publish_generated_columns = stored)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP PUBLICATION IF EXISTS "clickhouse_sync"
    `);
  }
}
