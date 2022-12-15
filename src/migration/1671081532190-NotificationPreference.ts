import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreference1671081532190 implements MigrationInterface {
  name = 'NotificationPreference1671081532190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_preference" ("userId" text NOT NULL, "marketingEmail" boolean NOT NULL DEFAULT false, "notificationEmail" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_1bb9930b0c0ab86ba5f95c4c62c" PRIMARY KEY ("userId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_preference"`);
  }
}
