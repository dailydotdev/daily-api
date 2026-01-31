import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfileAnalytics1768505964487 implements MigrationInterface {
  name = 'UserProfileAnalytics1768506000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_profile_analytics" (
          "id" text NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "uniqueVisitors" integer NOT NULL DEFAULT '0',
          CONSTRAINT "PK_user_profile_analytics" PRIMARY KEY ("id")
        )`,
    );

    await queryRunner.query(
      `CREATE TABLE "user_profile_analytics_history" (
          "id" text NOT NULL,
          "date" text NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "uniqueVisitors" integer NOT NULL DEFAULT '0',
          CONSTRAINT "PK_user_profile_analytics_history" PRIMARY KEY ("id", "date")
        )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_profile_analytics_history"`);
    await queryRunner.query(`DROP TABLE "user_profile_analytics"`);
  }
}
