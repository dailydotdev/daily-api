import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Denormalizes NotificationV2.type onto user_notification so the notifications
 * feed can filter by type (`WHERE un."type" = ANY(...)`) using an index instead
 * of scanning a heavy user's rows and discarding non-matching types post-join.
 *
 * The column is nullable with no default, so adding it is an instant metadata
 * change (no table rewrite). New rows are populated by storeNotificationBundleV2;
 * historical rows are backfilled separately in batches (see
 * src/migration/notes/backfill-user-notification-type.sql) — a full UPDATE here
 * would run inside the migration transaction and lock the largest table.
 *
 * The index is created non-CONCURRENTLY (migrations run in a transaction). In
 * production build it live with CREATE INDEX CONCURRENTLY first so this becomes
 * an IF NOT EXISTS no-op; smaller environments create it inline.
 */
export class AddUserNotificationType1782500000000
  implements MigrationInterface
{
  name = 'AddUserNotificationType1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_notification" ADD COLUMN IF NOT EXISTS "type" text;
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_notification_userId_type_date"
        ON "user_notification" ("userId", "type", (COALESCE("showAt", "createdAt")) DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_user_notification_userId_type_date";
    `);
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_notification" DROP COLUMN IF EXISTS "type";
    `);
  }
}
