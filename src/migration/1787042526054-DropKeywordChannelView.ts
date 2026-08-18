import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropKeywordChannelView1787042526054 implements MigrationInterface {
  name = 'DropKeywordChannelView1787042526054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "public"."UQ_keyword_channel_keyword_channel"
    `);

    await queryRunner.query(
      /* sql */ `
        DELETE FROM "public"."typeorm_metadata"
        WHERE "type" = $1
          AND "name" = $2
          AND "schema" = $3
      `,
      ['MATERIALIZED_VIEW', 'keyword_channel', 'public'],
    );

    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW IF EXISTS "keyword_channel"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW "keyword_channel" AS
        SELECT
          "pk"."keyword" AS "keyword",
          "cd"."channel" AS "channel",
          count(*) AS "posts"
        FROM "public"."post_keyword" "pk"
          INNER JOIN "public"."post" "p"
            ON "p"."id" = pk."postId"
            AND "p"."deleted" = false
            AND "p"."visible" = true
            AND "p"."private" = false
            AND p."createdAt" > now() - interval '48 hours'
          INNER JOIN "public"."channel_digest" "cd"
            ON "cd"."enabled" = true
            AND (p."contentMeta"->'channels') ? "cd"."channel"
        GROUP BY "pk"."keyword", "cd"."channel"
    `);

    await queryRunner.query(
      /* sql */ `
        INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value")
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      [
        'public',
        'MATERIALIZED_VIEW',
        'keyword_channel',
        'SELECT "pk"."keyword" AS "keyword", "cd"."channel" AS "channel", count(*) AS "posts" FROM "public"."post_keyword" "pk" INNER JOIN "public"."post" "p" ON "p"."id" = pk."postId" AND "p"."deleted" = false AND "p"."visible" = true AND "p"."private" = false AND p."createdAt" > now() - interval \'48 hours\'  INNER JOIN "public"."channel_digest" "cd" ON "cd"."enabled" = true AND (p."contentMeta"->\'channels\') ? "cd"."channel" GROUP BY "pk"."keyword", "cd"."channel"',
      ],
    );

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_keyword_channel_keyword_channel"
        ON "keyword_channel" ("keyword", "channel")
    `);
  }
}
