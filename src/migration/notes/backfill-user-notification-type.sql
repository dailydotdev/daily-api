-- Backfill user_notification.type from notification_v2 for rows created before
-- the AddUserNotificationType migration. Run OUTSIDE a migration transaction
-- (e.g. psql against the primary) so each batch commits independently and locks
-- stay short. Safe to re-run; it only touches rows whose type is still NULL.
--
-- user_notification is one of the largest tables, so this is intentionally a
-- bounded loop rather than a single UPDATE.

DO $$
DECLARE
  rows_updated integer;
BEGIN
  LOOP
    WITH batch AS (
      SELECT un."notificationId", un."userId"
      FROM "user_notification" un
      WHERE un."type" IS NULL
      LIMIT 10000
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "user_notification" un
    SET "type" = nv2."type"
    FROM batch
    JOIN "notification_v2" nv2 ON nv2."id" = batch."notificationId"
    WHERE un."notificationId" = batch."notificationId"
      AND un."userId" = batch."userId";

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'backfilled % rows', rows_updated;
    EXIT WHEN rows_updated = 0;

    COMMIT;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
