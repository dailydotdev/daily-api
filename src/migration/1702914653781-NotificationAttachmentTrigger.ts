import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationAttachmentTrigger1702914653781 implements MigrationInterface {
    name = 'NotificationAttachmentTrigger1702914653781'

    public async up(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_post_notification_attachment()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          IF NEW."type" <> OLD."type" OR NEW."image" <> OLD."image" THEN
            IF NEW."type" LIKE 'video:%' THEN
              UPDATE notification_attachment_v2
              SET type = 'video', image = COALESCE(NEW."image", OLD."image")
              WHERE "referenceId" = NEW."id" AND type IN ('post', 'video');
            ELSE
              UPDATE notification_attachment_v2
              SET type = 'post', image = COALESCE(NEW."image", OLD."image")
              WHERE "referenceId" = NEW."id" AND type IN ('post', 'video');
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$
      `);
      queryRunner.query(`CREATE TRIGGER update_post_notification_attachment AFTER UPDATE ON "post" FOR EACH ROW EXECUTE PROCEDURE update_post_notification_attachment()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS update_post_notification_attachment ON post');
      queryRunner.query('DROP FUNCTION IF EXISTS update_post_notification_attachment');
    }

}
