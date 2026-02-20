import { MigrationInterface, QueryRunner } from 'typeorm';

export class SquadPostsAnalytics1771105000000 implements MigrationInterface {
  name = 'SquadPostsAnalytics1771105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP MATERIALIZED VIEW IF EXISTS squad_posts_analytics',
    );

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW squad_posts_analytics AS
      SELECT
        p."sourceId" AS id,
        COALESCE(SUM(pa.impressions + pa."impressionsAds"), 0)::integer AS impressions,
        COALESCE(SUM(pa.reach), 0)::integer AS reach,
        COALESCE(SUM(pa."reachAll"), 0)::integer AS "reachAll",
        COALESCE(SUM(pa.upvotes), 0)::integer AS upvotes,
        COALESCE(SUM(pa.downvotes), 0)::integer AS downvotes,
        COALESCE(SUM(pa.comments), 0)::integer AS comments,
        COALESCE(SUM(pa.bookmarks), 0)::integer AS bookmarks,
        COALESCE(SUM(pa.awards), 0)::integer AS awards,
        COALESCE(SUM(pa."sharesInternal" + pa."sharesExternal"), 0)::integer AS shares,
        COALESCE(SUM(pa.clicks + pa."clicksAds" + pa."goToLink"), 0)::integer AS clicks,
        NOW() AS "updatedAt"
      FROM post p
      INNER JOIN post_analytics pa ON p.id = pa.id
      WHERE p."sourceId" IS NOT NULL
        AND p.deleted = false
        AND p.visible = true
      GROUP BY p."sourceId"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX squad_posts_analytics_id_idx ON squad_posts_analytics (id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP MATERIALIZED VIEW IF EXISTS squad_posts_analytics',
    );
  }
}
