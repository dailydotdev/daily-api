import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedSourceBlockUnsubscribe1709739543179 implements MigrationInterface {
    name = 'FeedSourceBlockUnsubscribe1709739543179'

    public async up(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION unsubscribe_notification_source_post_added()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          DELETE FROM notification_preference WHERE
            "sourceId" = NEW."sourceId"
             AND "userId" = NEW."feedId"
             AND "notificationType" = 'source_post_added'
             AND type = 'source'
             AND status = 'subscribed';
          RETURN NEW;
        END;
        $$
      `)
      queryRunner.query('CREATE TRIGGER unsubscribe_notification_source_post_added_trigger AFTER INSERT ON "feed_source" FOR EACH ROW EXECUTE PROCEDURE unsubscribe_notification_source_post_added()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS unsubscribe_notification_source_post_added_trigger ON feed_source')
      queryRunner.query('DROP FUNCTION IF EXISTS unsubscribe_notification_source_post_added')
    }

}
