import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostAnalyticsHistory1755090244241 implements MigrationInterface {
  name = 'PostAnalyticsHistory1755090244241';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "post_analytics_history" ("id" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "date" character varying NOT NULL, "impressions" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_6bb82232882b9a8bfa54a034c5f" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "post_analytics_history"`);
  }
}
