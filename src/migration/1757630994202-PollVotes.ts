import { MigrationInterface, QueryRunner } from 'typeorm';

export class PollVotes1757630994202 implements MigrationInterface {
  name = 'PollVotes1757630994202';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_post_poll_vote_insert_trigger_function()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW."pollVoteOptionId" IS NOT NULL THEN
                    UPDATE poll_option SET "numVotes" = "numVotes" + 1 WHERE id = NEW."pollVoteOptionId";
                    
                    UPDATE post SET "numPollVotes" = "numPollVotes" + 1
                    WHERE id = NEW."postId";
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER user_post_poll_vote_insert_trigger
            AFTER INSERT ON user_post
            FOR EACH ROW
            EXECUTE FUNCTION user_post_poll_vote_insert_trigger_function();
        `);

    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_post_poll_vote_delete_trigger_function()
            RETURNS TRIGGER AS $$
            BEGIN
                IF OLD."pollVoteOptionId" IS NOT NULL THEN
                    UPDATE poll_option SET "numVotes" = GREATEST("numVotes" - 1, 0) WHERE id = OLD."pollVoteOptionId";
                    
                    UPDATE post SET "numPollVotes" = GREATEST("numPollVotes" - 1, 0)
                    WHERE id = OLD."postId";
                END IF;

                RETURN OLD;
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER user_post_poll_vote_delete_trigger
            AFTER DELETE ON user_post
            FOR EACH ROW
            EXECUTE FUNCTION user_post_poll_vote_delete_trigger_function();
        `);

    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION user_post_poll_vote_update_trigger_function()
            RETURNS TRIGGER AS $$
            BEGIN
                IF OLD."pollVoteOptionId" IS NULL AND NEW."pollVoteOptionId" IS NOT NULL THEN
                    UPDATE poll_option SET "numVotes" = "numVotes" + 1 WHERE id = NEW."pollVoteOptionId";
                    UPDATE post SET "numPollVotes" = "numPollVotes" + 1 WHERE id = NEW."postId";
                ELSIF OLD."pollVoteOptionId" IS NOT NULL AND NEW."pollVoteOptionId" IS NULL THEN
                    UPDATE poll_option SET "numVotes" = GREATEST("numVotes" - 1, 0) WHERE id = OLD."pollVoteOptionId";
                    UPDATE post SET "numPollVotes" = GREATEST("numPollVotes" - 1, 0) WHERE id = OLD."postId";
                ELSIF OLD."pollVoteOptionId" IS NOT NULL AND NEW."pollVoteOptionId" IS NOT NULL
                      AND OLD."pollVoteOptionId" != NEW."pollVoteOptionId" THEN
                    UPDATE poll_option SET "numVotes" = GREATEST("numVotes" - 1, 0) WHERE id = OLD."pollVoteOptionId";
                    UPDATE poll_option SET "numVotes" = "numVotes" + 1 WHERE id = NEW."pollVoteOptionId";
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER user_post_poll_vote_update_trigger
            AFTER UPDATE ON user_post
            FOR EACH ROW
            EXECUTE FUNCTION user_post_poll_vote_update_trigger_function();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_post_poll_vote_update_trigger ON user_post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_post_poll_vote_update_trigger_function',
    );

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_post_poll_vote_delete_trigger ON user_post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_post_poll_vote_delete_trigger_function',
    );

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_post_poll_vote_insert_trigger ON user_post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_post_poll_vote_insert_trigger_function',
    );
  }
}
