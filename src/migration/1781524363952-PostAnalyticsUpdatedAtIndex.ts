import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsUpdatedAtIndex1781524363952 implements MigrationInterface {
  name = 'PostAnalyticsUpdatedAtIndex1781524363952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_post_analytics_updatedAt" ON "post_analytics" ("updatedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_post_analytics_updatedAt"`,
    );
  }
}
