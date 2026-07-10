import { MigrationInterface, QueryRunner } from 'typeorm';

export class KeywordChannelView1782457821133 implements MigrationInterface {
  name = 'KeywordChannelView1782457821133';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "keyword_channel" AS SELECT "pk"."keyword" AS "keyword", "cd"."channel" AS "channel", count(*) AS "posts" FROM "public"."post_keyword" "pk" INNER JOIN "public"."post" "p" ON "p"."id" = pk."postId" AND "p"."deleted" = false AND "p"."visible" = true AND "p"."private" = false AND p."createdAt" > now() - interval '48 hours'  INNER JOIN "public"."channel_digest" "cd" ON "cd"."enabled" = true AND (p."contentMeta"->'channels') ? "cd"."channel" GROUP BY "pk"."keyword", "cd"."channel"`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'keyword_channel',
        'SELECT "pk"."keyword" AS "keyword", "cd"."channel" AS "channel", count(*) AS "posts" FROM "public"."post_keyword" "pk" INNER JOIN "public"."post" "p" ON "p"."id" = pk."postId" AND "p"."deleted" = false AND "p"."visible" = true AND "p"."private" = false AND p."createdAt" > now() - interval \'48 hours\'  INNER JOIN "public"."channel_digest" "cd" ON "cd"."enabled" = true AND (p."contentMeta"->\'channels\') ? "cd"."channel" GROUP BY "pk"."keyword", "cd"."channel"',
      ],
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_keyword_channel_keyword_channel" ON "keyword_channel" ("keyword", "channel") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_keyword_channel_keyword_channel"`,
    );
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'keyword_channel', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "keyword_channel"`);
  }
}
