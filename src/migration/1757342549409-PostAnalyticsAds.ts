import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsAds1757342549409 implements MigrationInterface {
  name = 'PostAnalyticsAds1757342549409';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "boostImpressions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "boostReach"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "impressionsAds" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "reachAds" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "reachAll" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics_history" ADD "impressionsAds" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics_history" DROP COLUMN "impressionsAds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "reachAll"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "reachAds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "impressionsAds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "boostReach" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "boostImpressions" integer NOT NULL DEFAULT '0'`,
    );
  }
}
