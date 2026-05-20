import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationUnreadVisibleIndex1779257808707
  implements MigrationInterface
{
  name = 'UserNotificationUnreadVisibleIndex1779257808707';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_user_notification_unread_visible"
      ON "user_notification" (
        "userId",
        "showAt"
      )
      WHERE "readAt" IS NULL AND "public" = true
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS
        "IDX_user_notification_userid_readat_null"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS
        "IDX_user_notification_userid_public_readat"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_user_notification_userid_public_readat"
      ON "user_notification" (
        "userId",
        "public",
        "readAt"
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_user_notification_userid_readat_null"
      ON "user_notification" ("userId")
      WHERE "readAt" IS NULL
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS
        "IDX_user_notification_unread_visible"
    `);
  }
}
