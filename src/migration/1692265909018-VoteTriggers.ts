import { MigrationInterface, QueryRunner } from "typeorm";

export class VoteTriggers1692265909018 implements MigrationInterface {
    name = 'VoteTriggers1692265909018'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query('DROP TRIGGER IF EXISTS upvote_create_trigger ON upvote')
      await queryRunner.query('DROP TRIGGER IF EXISTS upvote_delete_trigger ON upvote')

      await queryRunner.query('DROP TRIGGER IF EXISTS downvote_create_trigger ON downvote')
      await queryRunner.query('DROP TRIGGER IF EXISTS downvote_delete_trigger ON downvote')

      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION user_post_vote_insert_trigger_function()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.vote = 1 THEN
                UPDATE post SET upvotes = upvotes + 1 WHERE id = NEW."postId";
            ELSIF NEW.vote = -1 THEN
                UPDATE post SET downvotes = downvotes + 1 WHERE id = NEW."postId";
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)
      await queryRunner.query(`
        CREATE TRIGGER user_post_vote_insert_trigger
        AFTER INSERT ON user_post
        FOR EACH ROW
        EXECUTE FUNCTION user_post_vote_insert_trigger_function();
      `)

      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION user_post_vote_update_trigger_function()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.vote IS DISTINCT FROM NEW.vote THEN
                IF OLD.vote = 0 AND NEW.vote = 1 THEN
                    UPDATE post SET upvotes = upvotes + 1 WHERE id = NEW."postId";
                ELSIF OLD.vote = 0 AND NEW.vote = -1 THEN
                    UPDATE post SET downvotes = downvotes + 1 WHERE id = NEW."postId";
                ELSIF OLD.vote = 1 AND NEW.vote = 0 THEN
                    UPDATE post SET upvotes = upvotes - 1 WHERE id = NEW."postId";
                ELSIF OLD.vote = -1 AND NEW.vote = 0 THEN
                    UPDATE post SET downvotes = downvotes - 1 WHERE id = NEW."postId";
                ELSIF OLD.vote = 1 AND NEW.vote = -1 THEN
                    UPDATE post SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW."postId";
                ELSIF OLD.vote = -1 AND NEW.vote = 1 THEN
                    UPDATE post SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE id = NEW."postId";
                END IF;
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)
      await queryRunner.query(`
        CREATE TRIGGER user_post_vote_update_trigger
        AFTER UPDATE ON user_post
        FOR EACH ROW
        EXECUTE FUNCTION user_post_vote_update_trigger_function();
      `)

      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION user_post_vote_delete_trigger_function()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.vote = 1 THEN
                UPDATE post SET upvotes = upvotes - 1 WHERE id = OLD."postId";
            ELSIF OLD.vote = -1 THEN
                UPDATE post SET downvotes = downvotes - 1 WHERE id = OLD."postId";
            END IF;

            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
      `)
      await queryRunner.query(`
        CREATE TRIGGER user_post_vote_delete_trigger
        AFTER DELETE ON user_post
        FOR EACH ROW
        EXECUTE FUNCTION user_post_vote_delete_trigger_function();
      `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query('DROP TRIGGER IF EXISTS user_post_vote_delete_trigger ON user_post')
      await queryRunner.query('DROP FUNCTION IF EXISTS user_post_vote_delete_trigger_function')

      await queryRunner.query('DROP TRIGGER IF EXISTS user_post_vote_update_trigger ON user_post')
      await queryRunner.query('DROP FUNCTION IF EXISTS user_post_vote_update_trigger_function')

      await queryRunner.query('DROP TRIGGER IF EXISTS user_post_vote_insert_trigger ON user_post')
      await queryRunner.query('DROP FUNCTION IF EXISTS user_post_vote_insert_trigger_function')

      await queryRunner.query('CREATE TRIGGER downvote_create_trigger AFTER INSERT ON "downvote" FOR EACH ROW EXECUTE PROCEDURE increment_downvote()')
      await queryRunner.query('CREATE TRIGGER downvote_delete_trigger AFTER DELETE ON "downvote" FOR EACH ROW EXECUTE PROCEDURE decrement_downvote()')

      await queryRunner.query('CREATE TRIGGER upvote_create_trigger AFTER INSERT ON "upvote" FOR EACH ROW EXECUTE PROCEDURE increment_upvote()')
      await queryRunner.query('CREATE TRIGGER upvote_delete_trigger AFTER DELETE ON "upvote" FOR EACH ROW EXECUTE PROCEDURE decrement_upvote()')
    }

}
