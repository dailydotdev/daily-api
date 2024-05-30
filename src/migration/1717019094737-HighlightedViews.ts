import { MigrationInterface, QueryRunner } from 'typeorm';

export class HighlightedViews1717019094737 implements MigrationInterface {
  name = 'HighlightedViews1717019094737';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "trending_post" AS SELECT "sourceId", "tagsStr", "createdAt", log(10, upvotes - downvotes) + extract(epoch from ("createdAt" - now() + interval '7 days')) / 200000 r FROM "public"."post" "p" WHERE not "p"."private" and p."createdAt" > now() - interval '7 day' and upvotes > downvotes ORDER BY r DESC LIMIT 100`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'trending_post',
        'SELECT "sourceId", "tagsStr", "createdAt", log(10, upvotes - downvotes) + extract(epoch from ("createdAt" - now() + interval \'7 days\')) / 200000 r FROM "public"."post" "p" WHERE not "p"."private" and p."createdAt" > now() - interval \'7 day\' and upvotes > downvotes ORDER BY r DESC LIMIT 100',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "trending_tag" AS SELECT unnest(string_to_array("tagsStr", ',')) tag, avg(r) r FROM "public"."trending_post" "base" GROUP BY tag HAVING count(*) > 1 ORDER BY r DESC`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'trending_tag',
        'SELECT unnest(string_to_array("tagsStr", \',\')) tag, avg(r) r FROM "public"."trending_post" "base" GROUP BY tag HAVING count(*) > 1 ORDER BY r DESC',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "trending_source" AS SELECT "sourceId", avg(r) r FROM "public"."trending_post" "base" GROUP BY "sourceId" HAVING count(*) > 1 ORDER BY r DESC`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'trending_source',
        'SELECT "sourceId", avg(r) r FROM "public"."trending_post" "base" GROUP BY "sourceId" HAVING count(*) > 1 ORDER BY r DESC',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "popular_video_post" AS SELECT "sourceId", "tagsStr", "createdAt", upvotes - downvotes r FROM "public"."post" "p" WHERE not "p"."private" and p."createdAt" > now() - interval '60 day' and upvotes > downvotes and "type" = 'video:youtube' ORDER BY r DESC LIMIT 1000`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'popular_video_post',
        'SELECT "sourceId", "tagsStr", "createdAt", upvotes - downvotes r FROM "public"."post" "p" WHERE not "p"."private" and p."createdAt" > now() - interval \'60 day\' and upvotes > downvotes and "type" = \'video:youtube\' ORDER BY r DESC LIMIT 1000',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "popular_post" AS SELECT "sourceId", "tagsStr", "createdAt", upvotes - downvotes r FROM "public"."post" "p" WHERE not "p"."private" and p."createdAt" > now() - interval '60 day' and upvotes > downvotes ORDER BY r DESC LIMIT 1000`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'popular_post',
        'SELECT "sourceId", "tagsStr", "createdAt", upvotes - downvotes r FROM "public"."post" "p" WHERE not "p"."private" and p."createdAt" > now() - interval \'60 day\' and upvotes > downvotes ORDER BY r DESC LIMIT 1000',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "popular_tag" AS SELECT unnest(string_to_array("tagsStr", ',')) tag, avg(r) r FROM "public"."popular_post" "base" GROUP BY tag HAVING count(*) > 10 ORDER BY r DESC`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'popular_tag',
        'SELECT unnest(string_to_array("tagsStr", \',\')) tag, avg(r) r FROM "public"."popular_post" "base" GROUP BY tag HAVING count(*) > 10 ORDER BY r DESC',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "popular_video_source" AS SELECT "sourceId", avg(r) r, count(*) posts FROM "public"."popular_video_post" "base" GROUP BY "sourceId" HAVING count(*) > 5 ORDER BY r DESC`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'popular_video_source',
        'SELECT "sourceId", avg(r) r, count(*) posts FROM "public"."popular_video_source" "base" GROUP BY "sourceId" HAVING count(*) > 5 ORDER BY r DESC',
      ],
    );
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "popular_source" AS SELECT "sourceId", avg(r) r FROM "public"."popular_post" "base" GROUP BY "sourceId" HAVING count(*) > 5 ORDER BY r DESC`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'popular_source',
        'SELECT "sourceId", avg(r) r FROM "public"."popular_post" "base" GROUP BY "sourceId" HAVING count(*) > 5 ORDER BY r DESC',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'popular_source', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "popular_source"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'popular_video_source', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "popular_video_source"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'popular_tag', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "popular_tag"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'popular_post', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "popular_post"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'popular_video_post', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "popular_video_post"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'trending_source', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "trending_source"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'trending_tag', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "trending_tag"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'trending_post', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "trending_post"`);
  }
}
