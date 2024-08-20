import '../src/config';
import createOrGetConnection from '../src/db';

/**
 * Bin script to retroactively insert missing follows for users who previously where subscribed to a source but didn't explicitly follow it.
 */

(async () => {
  const con = await createOrGetConnection();

  await con.query(
    `
      ALTER TABLE feed_source DISABLE TRIGGER unsubscribe_notification_source_post_added_trigger;

      INSERT INTO feed_source ("feedId", "sourceId", "blocked")
      SELECT  notification_preference."userId" as "feedId", notification_preference."sourceId", false as "blocked" FROM notification_preference
      WHERE
        NOT EXISTS (SELECT *
                    FROM feed_source
                    WHERE feed_source."sourceId" = notification_preference."sourceId" AND feed_source."feedId" = notification_preference."userId")
        AND "type" = 'source' AND "status" = 'subscribed';

      ALTER TABLE feed_source ENABLE TRIGGER unsubscribe_notification_source_post_added_trigger;
    `,
  );
  console.log('inserted feed_source records');

  process.exit();
})();
