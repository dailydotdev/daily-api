import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCommentTriggers1711649106510 implements MigrationInterface {
    name = 'UserCommentTriggers1711649106510'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_comment_vote_insert_trigger_function()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.vote = 1 THEN
                    UPDATE comment SET upvotes = upvotes + 1 WHERE id = NEW."commentId";
                ELSIF NEW.vote = -1 THEN
                    UPDATE comment SET downvotes = downvotes + 1 WHERE id = NEW."commentId";
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `)
        await queryRunner.query(`
            CREATE TRIGGER user_comment_vote_insert_trigger
            AFTER INSERT ON user_comment
            FOR EACH ROW
            EXECUTE FUNCTION user_comment_vote_insert_trigger_function();
        `)

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_comment_vote_update_trigger_function()
            RETURNS TRIGGER AS $$
            BEGIN
                IF OLD.vote IS DISTINCT FROM NEW.vote THEN
                    IF OLD.vote = 0 AND NEW.vote = 1 THEN
                        UPDATE comment SET upvotes = upvotes + 1 WHERE id = NEW."commentId";
                    ELSIF OLD.vote = 0 AND NEW.vote = -1 THEN
                        UPDATE comment SET downvotes = downvotes + 1 WHERE id = NEW."commentId";
                    ELSIF OLD.vote = 1 AND NEW.vote = 0 THEN
                        UPDATE comment SET upvotes = upvotes - 1 WHERE id = NEW."commentId";
                    ELSIF OLD.vote = -1 AND NEW.vote = 0 THEN
                        UPDATE comment SET downvotes = downvotes - 1 WHERE id = NEW."commentId";
                    ELSIF OLD.vote = 1 AND NEW.vote = -1 THEN
                        UPDATE comment SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW."commentId";
                    ELSIF OLD.vote = -1 AND NEW.vote = 1 THEN
                        UPDATE comment SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE id = NEW."commentId";
                    END IF;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `)
        await queryRunner.query(`
            CREATE TRIGGER user_comment_vote_update_trigger
            AFTER UPDATE ON user_comment
            FOR EACH ROW
            EXECUTE FUNCTION user_comment_vote_update_trigger_function();
        `)

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_comment_vote_delete_trigger_function()
            RETURNS TRIGGER AS $$
            BEGIN
                IF OLD.vote = 1 THEN
                    UPDATE comment SET upvotes = upvotes - 1 WHERE id = OLD."commentId";
                ELSIF OLD.vote = -1 THEN
                    UPDATE comment SET downvotes = downvotes - 1 WHERE id = OLD."commentId";
                END IF;

                RETURN OLD;
            END;
            $$ LANGUAGE plpgsql;
        `)
        await queryRunner.query(`
            CREATE TRIGGER user_comment_vote_delete_trigger
            AFTER DELETE ON user_comment
            FOR EACH ROW
            EXECUTE FUNCTION user_comment_vote_delete_trigger_function();
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TRIGGER IF EXISTS user_comment_vote_delete_trigger ON user_comment')
        await queryRunner.query('DROP FUNCTION IF EXISTS user_comment_vote_delete_trigger_function')

        await queryRunner.query('DROP TRIGGER IF EXISTS user_comment_vote_update_trigger ON user_comment')
        await queryRunner.query('DROP FUNCTION IF EXISTS user_comment_vote_update_trigger_function')

        await queryRunner.query('DROP TRIGGER IF EXISTS user_comment_vote_insert_trigger ON user_comment')
        await queryRunner.query('DROP FUNCTION IF EXISTS user_comment_vote_insert_trigger_function')
    }

}
