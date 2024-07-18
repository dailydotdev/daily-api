import { MigrationInterface, QueryRunner } from "typeorm";
import { VoteTriggers1692265909018 } from "./1692265909018-VoteTriggers";

export class PostStatsTriggers1721310640980 implements MigrationInterface {
    name = 'PostStatsTriggers1721310640980'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION user_post_vote_insert_trigger_function()
          RETURNS TRIGGER AS $$
          BEGIN
              IF NEW.vote = 1 THEN
                  UPDATE post SET upvotes = upvotes + 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
              ELSIF NEW.vote = -1 THEN
                  UPDATE post SET downvotes = downvotes + 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
              END IF;

              RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `)

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION user_post_vote_update_trigger_function()
          RETURNS TRIGGER AS $$
          BEGIN
              IF OLD.vote IS DISTINCT FROM NEW.vote THEN
                  IF OLD.vote = 0 AND NEW.vote = 1 THEN
                      UPDATE post SET upvotes = upvotes + 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
                  ELSIF OLD.vote = 0 AND NEW.vote = -1 THEN
                      UPDATE post SET downvotes = downvotes + 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
                  ELSIF OLD.vote = 1 AND NEW.vote = 0 THEN
                      UPDATE post SET upvotes = upvotes - 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
                  ELSIF OLD.vote = -1 AND NEW.vote = 0 THEN
                      UPDATE post SET downvotes = downvotes - 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
                  ELSIF OLD.vote = 1 AND NEW.vote = -1 THEN
                      UPDATE post SET upvotes = upvotes - 1, downvotes = downvotes + 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
                  ELSIF OLD.vote = -1 AND NEW.vote = 1 THEN
                      UPDATE post SET downvotes = downvotes - 1, upvotes = upvotes + 1, "statsUpdatedAt" = NOW() WHERE id = NEW."postId";
                  END IF;
              END IF;

              RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `)

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION user_post_vote_delete_trigger_function()
          RETURNS TRIGGER AS $$
          BEGIN
              IF OLD.vote = 1 THEN
                  UPDATE post SET upvotes = upvotes - 1, "statsUpdatedAt" = NOW() WHERE id = OLD."postId";
              ELSIF OLD.vote = -1 THEN
                  UPDATE post SET downvotes = downvotes - 1, "statsUpdatedAt" = NOW() WHERE id = OLD."postId";
              END IF;

              RETURN OLD;
          END;
          $$ LANGUAGE plpgsql;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const previousMigration = new VoteTriggers1692265909018()
        await previousMigration.up(queryRunner)
    }

}
