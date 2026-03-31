import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TagMaterializedViews1774956867935 implements MigrationInterface {
  name = 'TagMaterializedViews1774956867935';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isNonProductionEnv = ['development', 'test'].includes(
      process.env.NODE_ENV ?? '',
    );
    const createdAtThreshold = isNonProductionEnv
      ? `'1970-01-01'`
      : `(current_timestamp - interval '90 day')::date`;
    const sourceTagViewExpression = `
      SELECT
        "s"."id" AS "sourceId",
        "pk"."keyword" AS "tag",
        COALESCE(SUM("p"."upvotes"), 0) AS "count"
      FROM "public"."source" "s"
      INNER JOIN "public"."post" "p"
        ON "p"."sourceId" = "s"."id"
       AND "p"."createdAt" > ${createdAtThreshold}
      INNER JOIN "public"."post_keyword" "pk"
        ON "pk"."postId" = "p"."id"
       AND "pk"."status" = 'allow'
      WHERE ("s"."active" = true AND "s"."private" = false)
      GROUP BY "s"."id", "pk"."keyword"
    `;
    const userTagViewExpression = `
      SELECT
        "p"."authorId" AS "userId",
        "pk"."keyword" AS "tag",
        COALESCE(SUM("p"."upvotes"), 0) AS "count"
      FROM "public"."post" "p"
      INNER JOIN "public"."post_keyword" "pk"
        ON "pk"."postId" = "p"."id"
       AND "pk"."status" = 'allow'
      WHERE "p"."authorId" IS NOT NULL
        AND "p"."createdAt" > ${createdAtThreshold}
      GROUP BY "p"."authorId", "pk"."keyword"
    `;
    const sourceSimilarityViewExpression = `
      WITH ranked_source_tags AS (
        SELECT
          "sourceId",
          "tag",
          "count",
          row_number() OVER (
            PARTITION BY "sourceId"
            ORDER BY "count" DESC, "tag" ASC
          ) AS "rn"
        FROM "source_tag_view"
      ),
      tag_overlaps AS (
        SELECT
          "leftTags"."sourceId" AS "sourceId",
          "rightTags"."sourceId" AS "similarSourceId",
          COUNT(*) AS "count"
        FROM ranked_source_tags "leftTags"
        INNER JOIN ranked_source_tags "rightTags"
          ON "leftTags"."tag" = "rightTags"."tag"
         AND "leftTags"."sourceId" != "rightTags"."sourceId"
        WHERE "leftTags"."rn" <= 10
          AND "rightTags"."rn" <= 10
        GROUP BY 1, 2
      ),
      ranked_similar_sources AS (
        SELECT
          "sourceId",
          "similarSourceId",
          "count",
          row_number() OVER (
            PARTITION BY "sourceId"
            ORDER BY "count" DESC, "similarSourceId" ASC
          ) AS "rn"
        FROM tag_overlaps
      )
      SELECT
        "sourceId",
        "similarSourceId",
        "count"
      FROM ranked_similar_sources
      WHERE "rn" <= 6
    `;
    const userSimilarityViewExpression = `
      WITH ranked_user_tags AS (
        SELECT
          "userId",
          "tag",
          "count",
          row_number() OVER (
            PARTITION BY "userId"
            ORDER BY "count" DESC, "tag" ASC
          ) AS "rn"
        FROM "user_tag_view"
      ),
      tag_overlaps AS (
        SELECT
          "leftTags"."userId" AS "userId",
          "rightTags"."userId" AS "similarUserId",
          COUNT(*) AS "count"
        FROM ranked_user_tags "leftTags"
        INNER JOIN ranked_user_tags "rightTags"
          ON "leftTags"."tag" = "rightTags"."tag"
         AND "leftTags"."userId" != "rightTags"."userId"
        WHERE "leftTags"."rn" <= 10
          AND "rightTags"."rn" <= 10
        GROUP BY 1, 2
      ),
      ranked_similar_users AS (
        SELECT
          "userId",
          "similarUserId",
          "count",
          row_number() OVER (
            PARTITION BY "userId"
            ORDER BY "count" DESC, "similarUserId" ASC
          ) AS "rn"
        FROM tag_overlaps
      )
      SELECT
        "userId",
        "similarUserId",
        "count"
      FROM ranked_similar_users
      WHERE "rn" <= 6
    `;

    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'user_similarity_view', 'public'],
    );
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'source_similarity_view', 'public'],
    );
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'user_tag_view', 'public'],
    );
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'source_tag_view', 'public'],
    );
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW IF EXISTS "user_similarity_view"
    `);
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW IF EXISTS "source_similarity_view"
    `);
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW IF EXISTS "user_tag_view"
    `);
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW IF EXISTS "source_tag_view"
    `);
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_tagRecommendation_keywordX_keywordY"
    `);
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tagRecommendation_keywordX_keywordY"
        ON "tag_recommendation" ("keywordX", "keywordY")
    `);

    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW "source_tag_view" AS
      ${sourceTagViewExpression}
    `);
    await queryRunner.query(
      /* sql */ `
        INSERT INTO "public"."typeorm_metadata" (
          "database",
          "schema",
          "table",
          "type",
          "name",
          "value"
        )
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      [
        'public',
        'MATERIALIZED_VIEW',
        'source_tag_view',
        sourceTagViewExpression,
      ],
    );
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sourceTag_sourceId_tag"
        ON "source_tag_view" ("sourceId", "tag")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_sourceTag_sourceId"
        ON "source_tag_view" ("sourceId")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_sourceTag_tag"
        ON "source_tag_view" ("tag")
    `);

    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW "user_tag_view" AS
      ${userTagViewExpression}
    `);
    await queryRunner.query(
      /* sql */ `
        INSERT INTO "public"."typeorm_metadata" (
          "database",
          "schema",
          "table",
          "type",
          "name",
          "value"
        )
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      ['public', 'MATERIALIZED_VIEW', 'user_tag_view', userTagViewExpression],
    );
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_userTag_userId_tag"
        ON "user_tag_view" ("userId", "tag")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_userTag_userId"
        ON "user_tag_view" ("userId")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_userTag_tag"
        ON "user_tag_view" ("tag")
    `);

    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW "source_similarity_view" AS
      ${sourceSimilarityViewExpression}
    `);
    await queryRunner.query(
      /* sql */ `
        INSERT INTO "public"."typeorm_metadata" (
          "database",
          "schema",
          "table",
          "type",
          "name",
          "value"
        )
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      [
        'public',
        'MATERIALIZED_VIEW',
        'source_similarity_view',
        sourceSimilarityViewExpression,
      ],
    );
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sourceSimilarity_sourceId_similarSourceId"
        ON "source_similarity_view" ("sourceId", "similarSourceId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW "user_similarity_view" AS
      ${userSimilarityViewExpression}
    `);
    await queryRunner.query(
      /* sql */ `
        INSERT INTO "public"."typeorm_metadata" (
          "database",
          "schema",
          "table",
          "type",
          "name",
          "value"
        )
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      [
        'public',
        'MATERIALIZED_VIEW',
        'user_similarity_view',
        userSimilarityViewExpression,
      ],
    );
    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_userSimilarity_userId_similarUserId"
        ON "user_similarity_view" ("userId", "similarUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isNonProductionEnv = ['development', 'test'].includes(
      process.env.NODE_ENV ?? '',
    );
    const createdAtThreshold = isNonProductionEnv
      ? `'1970-01-01'`
      : `(current_timestamp - interval '90 day')::date`;
    const sourceTagViewExpression = `
      SELECT
        "s"."id" AS "sourceId",
        "pk"."keyword" AS "tag",
        COUNT("pk"."keyword") AS "count"
      FROM "public"."source" "s"
      INNER JOIN "public"."post" "p"
        ON "p"."sourceId" = "s"."id"
       AND "p"."createdAt" > ${createdAtThreshold}
      INNER JOIN "public"."post_keyword" "pk"
        ON "pk"."postId" = "p"."id"
       AND "pk"."status" = 'allow'
      WHERE ("s"."active" = true AND "s"."private" = false)
      GROUP BY "s"."id", "pk"."keyword"
    `;

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_userSimilarity_userId_similarUserId"
    `);
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'user_similarity_view', 'public'],
    );
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW "user_similarity_view"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_sourceSimilarity_sourceId_similarSourceId"
    `);
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'source_similarity_view', 'public'],
    );
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW "source_similarity_view"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_userTag_tag"
    `);
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_userTag_userId"
    `);
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_userTag_userId_tag"
    `);
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'user_tag_view', 'public'],
    );
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW "user_tag_view"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_sourceTag_tag"
    `);
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_sourceTag_sourceId"
    `);
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_sourceTag_sourceId_tag"
    `);
    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'source_tag_view', 'public'],
    );
    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW "source_tag_view"
    `);

    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW "source_tag_view" AS
      ${sourceTagViewExpression}
    `);
    await queryRunner.query(
      /* sql */ `
        INSERT INTO "public"."typeorm_metadata" (
          "database",
          "schema",
          "table",
          "type",
          "name",
          "value"
        )
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      [
        'public',
        'MATERIALIZED_VIEW',
        'source_tag_view',
        sourceTagViewExpression,
      ],
    );
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_sourceTag_sourceId"
        ON "source_tag_view" ("sourceId")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_sourceTag_tag"
        ON "source_tag_view" ("tag")
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "UQ_tagRecommendation_keywordX_keywordY"
    `);
  }
}
