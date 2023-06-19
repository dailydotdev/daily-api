import { MigrationInterface, QueryRunner } from "typeorm";

export class UpvoteTrigger1686749310179 implements MigrationInterface {
    name = 'UpvoteTrigger1686749310179'

    public async up(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_upvote()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE post SET upvotes = upvotes + 1 WHERE id = NEW."postId";
          RETURN NEW;
        END;
        $$
      `)
      queryRunner.query('CREATE TRIGGER upvote_create_trigger AFTER INSERT ON "upvote" FOR EACH ROW EXECUTE PROCEDURE increment_upvote()')
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION decrement_upvote()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE post SET upvotes = upvotes - 1 WHERE id = OLD."postId";
          RETURN OLD;
        END;
        $$
      `)
      queryRunner.query('CREATE TRIGGER upvote_delete_trigger AFTER DELETE ON "upvote" FOR EACH ROW EXECUTE PROCEDURE decrement_upvote()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS upvote_create_trigger ON upvote')
      queryRunner.query('DROP FUNCTION IF EXISTS increment_upvote')
      queryRunner.query('DROP TRIGGER IF EXISTS upvote_delete_trigger ON upvote')
      queryRunner.query('DROP FUNCTION IF EXISTS decrement_upvote')
    }

}
