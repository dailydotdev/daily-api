import { MigrationInterface, QueryRunner } from "typeorm";

export class PopularUserSources1760104116722 implements MigrationInterface {
  name = 'PopularUserSources1760104116722'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "popular_post", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "popular_post"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "trending_post", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "trending_post"
    `);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "trending_post" AS
      SELECT
        p."sourceId",
        p."tagsStr",
        p."createdAt",
        log(10, "p"."upvotes" - "p"."downvotes") + extract(epoch from (p."createdAt" - now() + interval '7 days')) / 200000 AS "r"
      FROM "public"."post" "p"
      INNER JOIN "public"."source" "s"
        ON "s"."id" = p."sourceId"
      WHERE
        NOT "p"."private"
        AND p."createdAt" > now() - interval '7 day'
        AND "p"."upvotes" > "p"."downvotes"
        AND "s"."type" != :type
      ORDER BY
        r DESC
      LIMIT 100
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "trending_post", "SELECT p.\"sourceId\", p.\"tagsStr\", p.\"createdAt\", log(10, \"p\".\"upvotes\" - \"p\".\"downvotes\") + extract(epoch from (p.\"createdAt\" - now() + interval '7 days')) / 200000 AS \"r\" FROM \"public\".\"post\" \"p\" INNER JOIN \"public\".\"source\" \"s\" ON \"s\".\"id\" = p.\"sourceId\" WHERE not \"p\".\"private\" and p.\"createdAt\" > now() - interval '7 day' and \"p\".\"upvotes\" > \"p\".\"downvotes\" AND \"s\".\"type\" != :type ORDER BY r DESC LIMIT 100"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "popular_post" AS
      SELECT
        p."sourceId",
        p."tagsStr",
        p."createdAt",
        "p"."upvotes" - "p"."downvotes" AS "r"
      FROM "public"."post" "p"
      INNER JOIN "public"."source" "s"
        ON "s"."id" = p."sourceId"
      WHERE
        NOT "p"."private"
        AND p."createdAt" > now() - interval '60 day'
        AND "p"."upvotes" > "p"."downvotes"
        AND "s"."type" != :type
      ORDER BY
        r DESC
      LIMIT 1000
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "popular_post", "SELECT p.\"sourceId\", p.\"tagsStr\", p.\"createdAt\", \"p\".\"upvotes\" - \"p\".\"downvotes\" AS \"r\" FROM \"public\".\"post\" \"p\" INNER JOIN \"public\".\"source\" \"s\" ON \"s\".\"id\" = p.\"sourceId\" WHERE not \"p\".\"private\" and p.\"createdAt\" > now() - interval '60 day' and \"p\".\"upvotes\" > \"p\".\"downvotes\" AND \"s\".\"type\" != :type ORDER BY r DESC LIMIT 1000"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "trending_user_post" AS
      SELECT
        p."sourceId",
        p."tagsStr",
        p."createdAt",
        log(10, "p"."upvotes" - "p"."downvotes") + extract(epoch from (p."createdAt" - now() + interval '7 days')) / 200000 AS "r"
      FROM "public"."post" "p"
      INNER JOIN "public"."source" "s"
        ON "s"."id" = p."sourceId"
      WHERE
        NOT "p"."private"
        AND p."createdAt" > now() - interval '7 day'
        AND "p"."upvotes" > "p"."downvotes"
        AND "s"."type" = :type
      ORDER BY
        r DESC
      LIMIT 100
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "trending_user_post", "SELECT p.\"sourceId\", p.\"tagsStr\", p.\"createdAt\", log(10, \"p\".\"upvotes\" - \"p\".\"downvotes\") + extract(epoch from (p.\"createdAt\" - now() + interval '7 days')) / 200000 AS \"r\" FROM \"public\".\"post\" \"p\" INNER JOIN \"public\".\"source\" \"s\" ON \"s\".\"id\" = p.\"sourceId\" WHERE not \"p\".\"private\" and p.\"createdAt\" > now() - interval '7 day' and \"p\".\"upvotes\" > \"p\".\"downvotes\" AND \"s\".\"type\" = :type ORDER BY r DESC LIMIT 100"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "trending_user_source" AS
      SELECT
        "sourceId",
        avg(r) r
      FROM "public"."trending_user_post" "base"
      GROUP BY
        "sourceId"
      HAVING
        count(*) > 1
      ORDER BY
        r DESC
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "trending_user_source", "SELECT \"sourceId\", avg(r) r FROM \"public\".\"trending_user_post\" \"base\" GROUP BY \"sourceId\" HAVING count(*) > 1 ORDER BY r DESC"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "popular_user_post" AS
      SELECT
        p."sourceId",
        p."tagsStr",
        p."createdAt",
        "p"."upvotes" - "p"."downvotes" AS "r"
      FROM "public"."post" "p"
      INNER JOIN "public"."source" "s"
        ON "s"."id" = p."sourceId"
      WHERE
        NOT "p"."private"
        AND p."createdAt" > now() - interval '60 day'
        AND "p"."upvotes" > "p"."downvotes"
        AND "s"."type" = :type
      ORDER BY
        r DESC
      LIMIT 1000
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "popular_user_post", "SELECT p.\"sourceId\", p.\"tagsStr\", p.\"createdAt\", \"p\".\"upvotes\" - \"p\".\"downvotes\" AS \"r\" FROM \"public\".\"post\" \"p\" INNER JOIN \"public\".\"source\" \"s\" ON \"s\".\"id\" = p.\"sourceId\" WHERE not \"p\".\"private\" and p.\"createdAt\" > now() - interval '60 day' and \"p\".\"upvotes\" > \"p\".\"downvotes\" AND \"s\".\"type\" = :type ORDER BY r DESC LIMIT 1000"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "popular_user_source" AS
      SELECT
        "sourceId",
        avg(r) r
      FROM "public"."popular_user_post" "base"
      GROUP BY
        "sourceId"
      HAVING
        count(*) > 5
      ORDER BY
        r DESC
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "popular_user_source", "SELECT \"sourceId\", avg(r) r FROM \"public\".\"popular_user_post\" \"base\" GROUP BY \"sourceId\" HAVING count(*) > 5 ORDER BY r DESC"]);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "user_stats", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "user_stats"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "popular_video_source", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "popular_video_source"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "popular_user_source", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "popular_user_source"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "popular_user_post", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "popular_user_post"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "trending_user_source", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "trending_user_source"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "trending_user_post", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "trending_user_post"
    `);

    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "public"."IDX_user_stats_id"
    `);

    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "public"."IDX_sourceTag_tag"
    `);

    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "public"."IDX_sourceTag_sourceId"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "user_stats", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "user_stats"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "popular_post", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "popular_post"
    `);

    await queryRunner.query(/* sql */`
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `, ["MATERIALIZED_VIEW", "trending_post", "public"]);

    await queryRunner.query(/* sql */`
      DROP MATERIALIZED VIEW IF EXISTS "trending_post"
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "source_tag_view", "SELECT \"s\".\"id\" as \"sourceId\", \"pk\".\"keyword\" AS tag, count(\"pk\".\"keyword\") AS count FROM \"public\".\"source\" \"s\" INNER JOIN \"public\".\"post\" \"p\" ON \"p\".\"sourceId\" = \"s\".\"id\" AND \"p\".\"createdAt\" > '1970-01-01'  INNER JOIN \"public\".\"post_keyword\" \"pk\" ON \"pk\".\"postId\" = \"p\".\"id\" AND \"pk\".\"status\" = 'allow' WHERE (\"s\".\"active\" = true AND \"s\".\"private\" = false) GROUP BY \"s\".\"id\", tag"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "trending_post" AS
      SELECT
        "sourceId",
        "tagsStr",
        "createdAt",
        log(10, upvotes - downvotes) + extract(epoch from ("createdAt" - now() + interval '7 days')) / 200000 r
      FROM "public"."post" "p"
      WHERE
        NOT "p"."private"
        AND p."createdAt" > now() - interval '7 day'
        AND upvotes > downvotes
      ORDER BY
        r DESC
      LIMIT 100
    `);

    await queryRunner.query(/* sql */`
      INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `, ["public", "MATERIALIZED_VIEW", "trending_post", "SELECT \"sourceId\", \"tagsStr\", \"createdAt\", log(10, upvotes - downvotes) + extract(epoch from (\"createdAt\" - now() + interval '7 days')) / 200000 r FROM \"public\".\"post\" \"p\" WHERE not \"p\".\"private\" and p.\"createdAt\" > now() - interval '7 day' and upvotes > downvotes ORDER BY r DESC LIMIT 100"]);

    await queryRunner.query(/* sql */`
      CREATE MATERIALIZED VIEW "popular_post" AS
      SELECT
        "sourceId",
        "tagsStr",
        "createdAt",
        upvotes - downvotes r
      FROM "public"."post" "p"
      WHERE
        NOT "p"."private"
        AND p."createdAt" > now() - interval '60 day'
        AND upvotes > downvotes
      ORDER BY
        r DESC
      LIMIT 1000
    `);
  }
}
