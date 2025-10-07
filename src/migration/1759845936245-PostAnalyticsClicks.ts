import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsClicks1759845936245 implements MigrationInterface {
  name = 'PostAnalyticsClicks1759845936245';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "clicks" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "clicksAds" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "clicksAds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "clicks"`,
    );
  }
}
