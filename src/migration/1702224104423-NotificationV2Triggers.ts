import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationV2Triggers1702224104423 implements MigrationInterface {
  name = 'NotificationV2Triggers1702224104423';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_source_avatar()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          IF NEW."name" <> OLD."name" OR NEW."image" <> OLD."image" OR NEW."handle" <> OLD."handle" THEN
            UPDATE notification_avatar_v2
            SET name = NEW."name", image = NEW."image",
              "targetUrl" = '${process.env.COMMENTS_PREFIX}/' || (case when NEW."type" = 'squad' then 'squads' else 'sources' end) || '/' || NEW."handle"
            WHERE "referenceId" = NEW."id" AND type = 'source';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
    await queryRunner.query(
      'CREATE TRIGGER update_source_avatar AFTER UPDATE ON "source" FOR EACH ROW EXECUTE PROCEDURE update_source_avatar()',
    );

    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION update_user_avatar()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          IF NEW."name" <> OLD."name" OR NEW."image" <> OLD."image" OR NEW."username" <> OLD."username" THEN
            UPDATE notification_avatar_v2
            SET name = NEW."name", image = NEW."image",
              "targetUrl" = '${process.env.COMMENTS_PREFIX}/' || NEW."username"
            WHERE "referenceId" = NEW."id" AND type = 'user';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
    await queryRunner.query(
      'CREATE TRIGGER update_user_avatar AFTER UPDATE ON "user" FOR EACH ROW EXECUTE PROCEDURE update_user_avatar()',
    );

    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION delete_post_notifications()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          IF NOT OLD."deleted" AND NEW."deleted" THEN
            DELETE FROM notification_v2
            WHERE "referenceId" = NEW."id" AND "referenceType" = 'post';
          END IF;
          RETURN NEW;
        END;
        $$
      `);
    await queryRunner.query(
      'CREATE TRIGGER delete_post_notifications AFTER UPDATE ON "post" FOR EACH ROW EXECUTE PROCEDURE delete_post_notifications()',
    );

    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION delete_comment_notifications()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          DELETE FROM notification_v2
          WHERE "referenceId" = OLD."id" AND "referenceType" = 'comment';
          RETURN OLD;
        END;
        $$
      `);
    await queryRunner.query(
      'CREATE TRIGGER delete_comment_notifications AFTER DELETE ON "comment" FOR EACH ROW EXECUTE PROCEDURE delete_comment_notifications()',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_source_avatar ON "source"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS update_source_avatar');
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_user_avatar ON "user"',
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS update_user_avatar');
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS delete_post_notifications ON "post"',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS delete_post_notifications',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS delete_comment_notifications ON "comment"',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS delete_comment_notifications',
    );
  }
}
