import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExcludeBriefFromUserPostsAnalytics1770110333844
  implements MigrationInterface
{
  name = 'ExcludeBriefFromUserPostsAnalytics1770110333844';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS user_posts_analytics`,
    );

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW user_posts_analytics AS
      SELECT
        p."authorId" as id,
        COALESCE(SUM(pa.impressions + pa."impressionsAds"), 0)::integer as impressions,
        COALESCE(SUM(pa.reach), 0)::integer as reach,
        COALESCE(SUM(pa."reachAll"), 0)::integer as "reachAll",
        COALESCE(SUM(pa.upvotes), 0)::integer as upvotes,
        COALESCE(SUM(pa.downvotes), 0)::integer as downvotes,
        COALESCE(SUM(pa.comments), 0)::integer as comments,
        COALESCE(SUM(pa.bookmarks), 0)::integer as bookmarks,
        COALESCE(SUM(pa.awards), 0)::integer as awards,
        COALESCE(SUM(pa."profileViews"), 0)::integer as "profileViews",
        COALESCE(SUM(pa.followers), 0)::integer as followers,
        COALESCE(SUM(pa."squadJoins"), 0)::integer as "squadJoins",
        COALESCE(SUM(pa.reputation), 0)::integer as reputation,
        COALESCE(SUM(pa."coresEarned"), 0)::integer as "coresEarned",
        COALESCE(SUM(pa."sharesInternal" + pa."sharesExternal"), 0)::integer as shares,
        COALESCE(SUM(pa.clicks + pa."clicksAds" + pa."goToLink"), 0)::integer as clicks,
        NOW() as "updatedAt"
      FROM post p
      INNER JOIN post_analytics pa ON p.id = pa.id
      WHERE p."authorId" IS NOT NULL
        AND p.deleted = false
        AND p.visible = true
        AND p.type != 'brief'
      GROUP BY p."authorId"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX user_posts_analytics_id_idx ON user_posts_analytics (id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP MATERIALIZED VIEW IF EXISTS user_posts_analytics`,
    );

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW user_posts_analytics AS
      SELECT
        p."authorId" as id,
        COALESCE(SUM(pa.impressions + pa."impressionsAds"), 0)::integer as impressions,
        COALESCE(SUM(pa.reach), 0)::integer as reach,
        COALESCE(SUM(pa."reachAll"), 0)::integer as "reachAll",
        COALESCE(SUM(pa.upvotes), 0)::integer as upvotes,
        COALESCE(SUM(pa.downvotes), 0)::integer as downvotes,
        COALESCE(SUM(pa.comments), 0)::integer as comments,
        COALESCE(SUM(pa.bookmarks), 0)::integer as bookmarks,
        COALESCE(SUM(pa.awards), 0)::integer as awards,
        COALESCE(SUM(pa."profileViews"), 0)::integer as "profileViews",
        COALESCE(SUM(pa.followers), 0)::integer as followers,
        COALESCE(SUM(pa."squadJoins"), 0)::integer as "squadJoins",
        COALESCE(SUM(pa.reputation), 0)::integer as reputation,
        COALESCE(SUM(pa."coresEarned"), 0)::integer as "coresEarned",
        COALESCE(SUM(pa."sharesInternal" + pa."sharesExternal"), 0)::integer as shares,
        COALESCE(SUM(pa.clicks + pa."clicksAds" + pa."goToLink"), 0)::integer as clicks,
        NOW() as "updatedAt"
      FROM post p
      INNER JOIN post_analytics pa ON p.id = pa.id
      WHERE p."authorId" IS NOT NULL
        AND p.deleted = false
        AND p.visible = true
      GROUP BY p."authorId"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX user_posts_analytics_id_idx ON user_posts_analytics (id)
    `);
  }
}
