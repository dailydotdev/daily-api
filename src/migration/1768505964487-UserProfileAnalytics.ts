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

    await queryRunner.query(
      `ALTER TABLE "user_profile_analytics"
         ADD CONSTRAINT "FK_user_profile_analytics_user"
         FOREIGN KEY ("id") REFERENCES "user"("id")
         ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_profile_analytics_history"
         ADD CONSTRAINT "FK_user_profile_analytics_history_user"
         FOREIGN KEY ("id") REFERENCES "user"("id")
         ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_profile_analytics_history" DROP CONSTRAINT "FK_user_profile_analytics_history_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_profile_analytics" DROP CONSTRAINT "FK_user_profile_analytics_user"`,
    );
    await queryRunner.query(`DROP TABLE "user_profile_analytics_history"`);
    await queryRunner.query(`DROP TABLE "user_profile_analytics"`);
  }
}
