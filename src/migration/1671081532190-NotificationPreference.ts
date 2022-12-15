import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreference1671081532190 implements MigrationInterface {
  name = 'NotificationPreference1671081532190';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "general_notification_preference" ("userId" text NOT NULL, "marketingEmail" boolean NOT NULL DEFAULT false, "notificationEmail" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_1bb9930b0c0ab86ba5f95c4c62c" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_notification_preference" ("userId" text NOT NULL, "deviceId" text NOT NULL, "integrationId" text, "description" text NOT NULL, "pushNotification" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_3e642d1cd1f81ed0474b441d858" PRIMARY KEY ("userId", "deviceId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "device_notification_preference"`);
    await queryRunner.query(`DROP TABLE "general_notification_preference"`);
  }
}
