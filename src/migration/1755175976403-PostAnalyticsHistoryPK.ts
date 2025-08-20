import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsHistoryPK1755175976403 implements MigrationInterface {
  name = 'PostAnalyticsHistoryPK1755175976403';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics_history" DROP CONSTRAINT "PK_6bb82232882b9a8bfa54a034c5f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics_history" ADD CONSTRAINT "PK_cd7fc813c96551ea7b5d4f6e95a" PRIMARY KEY ("id", "date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post_analytics_history" DROP CONSTRAINT "PK_cd7fc813c96551ea7b5d4f6e95a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "post_analytics_history" ADD CONSTRAINT "PK_6bb82232882b9a8bfa54a034c5f" PRIMARY KEY ("id")`,
    );
  }
}
