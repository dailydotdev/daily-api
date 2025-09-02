import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsBoost1756806542962 implements MigrationInterface {
  name = 'PostAnalyticsBoost1756806542962';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "boostImpressions" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "boostReach" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "boostReach"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "boostImpressions"`,
    );
  }
}
