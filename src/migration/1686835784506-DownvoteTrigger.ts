import { MigrationInterface, QueryRunner } from "typeorm";

export class DownvoteTrigger1686835784506 implements MigrationInterface {
    name = 'DownvoteTrigger1686835784506'

    public async up(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_downvote()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE post SET downvotes = downvotes + 1 WHERE id = NEW."postId";
          RETURN NEW;
        END;
        $$
      `)
      queryRunner.query('CREATE TRIGGER downvote_create_trigger AFTER INSERT ON "downvote" FOR EACH ROW EXECUTE PROCEDURE increment_downvote()')
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION decrement_downvote()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE post SET downvotes = downvotes - 1 WHERE id = OLD."postId";
          RETURN OLD;
        END;
        $$
      `)
      queryRunner.query('CREATE TRIGGER downvote_delete_trigger AFTER DELETE ON "downvote" FOR EACH ROW EXECUTE PROCEDURE decrement_downvote()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS downvote_create_trigger ON downvote')
      queryRunner.query('DROP FUNCTION IF EXISTS increment_downvote')
      queryRunner.query('DROP TRIGGER IF EXISTS downvote_delete_trigger ON downvote')
      queryRunner.query('DROP FUNCTION IF EXISTS decrement_downvote')
    }

}
