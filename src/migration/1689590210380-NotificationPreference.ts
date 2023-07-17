import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreference1689590210380 implements MigrationInterface {
  name = 'NotificationPreference1689590210380';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_preference" ("userId" text NOT NULL, "notificationType" text NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "status" text NOT NULL, "postId" text, "sourceId" text, "commentId" text, CONSTRAINT "PK_dd257dfccc3dd38439cc79c861f" PRIMARY KEY ("userId", "notificationType", "postId", "sourceId", "commentId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65a9ca0600dbc72c6ff76501a6" ON "notification_preference" ("type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65a9ca0600dbc72c6ff76501a6"`,
    );
    await queryRunner.query(`DROP TABLE "notification_preference"`);
  }
}
