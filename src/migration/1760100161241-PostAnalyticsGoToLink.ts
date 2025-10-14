import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsGoToLink1760100161241 implements MigrationInterface {
  name = 'PostAnalyticsGoToLink1760100161241';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" ADD "goToLink" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics" DROP COLUMN "goToLink"`,
    );
  }
}
