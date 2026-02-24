import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnreadNotificationsCountTrigger1771941340099
  implements MigrationInterface
{
  name = 'UnreadNotificationsCountTrigger1771941340099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user"
        ADD "unreadNotificationsCount" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_unread_notifications_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
      AS $$
      BEGIN
        IF NEW."public" AND NEW."readAt" IS NULL THEN
          UPDATE "user"
          SET "unreadNotificationsCount" = "unreadNotificationsCount" + 1
          WHERE id = NEW."userId";
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TRIGGER increment_unread_notifications_count
        AFTER INSERT ON "user_notification"
        FOR EACH ROW
        EXECUTE PROCEDURE increment_unread_notifications_count()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_unread_notifications_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
      AS $$
      DECLARE
        delta INTEGER;
      BEGIN
        delta := (NEW."public" AND NEW."readAt" IS NULL)::int
               - (OLD."public" AND OLD."readAt" IS NULL)::int;

        IF delta != 0 THEN
          UPDATE "user"
          SET "unreadNotificationsCount" = GREATEST("unreadNotificationsCount" + delta, 0)
          WHERE id = NEW."userId";
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_unread_notifications_count
        AFTER UPDATE ON "user_notification"
        FOR EACH ROW
        EXECUTE PROCEDURE update_unread_notifications_count()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION decrement_unread_notifications_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
      AS $$
      BEGIN
        IF OLD."public" AND OLD."readAt" IS NULL THEN
          UPDATE "user"
          SET "unreadNotificationsCount" = GREATEST("unreadNotificationsCount" - 1, 0)
          WHERE id = OLD."userId";
        END IF;
        RETURN OLD;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TRIGGER decrement_unread_notifications_count
        AFTER DELETE ON "user_notification"
        FOR EACH ROW
        EXECUTE PROCEDURE decrement_unread_notifications_count()
    `);

    await queryRunner.query(`
      UPDATE "user" u
      SET "unreadNotificationsCount" = COALESCE(sub.cnt, 0)
      FROM (
        SELECT "userId", COUNT(*)::int AS cnt
        FROM "user_notification"
        WHERE "public" = TRUE AND "readAt" IS NULL
        GROUP BY "userId"
      ) sub
      WHERE u.id = sub."userId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS decrement_unread_notifications_count ON "user_notification"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_unread_notifications_count ON "user_notification"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS increment_unread_notifications_count ON "user_notification"`,
    );

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS decrement_unread_notifications_count()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_unread_notifications_count()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS increment_unread_notifications_count()`,
    );

    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "unreadNotificationsCount"`,
    );
  }
}
