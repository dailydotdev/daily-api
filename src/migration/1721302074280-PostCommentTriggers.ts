import { MigrationInterface, QueryRunner } from "typeorm";

export class PostCommentTriggers1721300643032 implements MigrationInterface {
    name = 'PostCommentTriggers1721300643032'

    public async up(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_post_comment_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE post SET comments = comments + 1 WHERE id = NEW."postId";
          RETURN NEW;
        END;
        $$
      `)
      queryRunner.query('CREATE OR REPLACE TRIGGER increment_post_comment_count_create_trigger AFTER INSERT ON "comment" FOR EACH ROW EXECUTE PROCEDURE increment_post_comment_count()')
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION decrement_post_comment_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE post SET comments = comments - 1 WHERE id = OLD."postId" AND comments > 0;
          RETURN OLD;
        END;
        $$
      `)
      queryRunner.query('CREATE OR REPLACE TRIGGER decrement_post_comment_count_delete_trigger AFTER DELETE ON "comment" FOR EACH ROW EXECUTE PROCEDURE decrement_post_comment_count()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS increment_post_comment_count_create_trigger ON comment')
      queryRunner.query('DROP FUNCTION IF EXISTS increment_post_comment_count')
      queryRunner.query('DROP TRIGGER IF EXISTS decrement_post_comment_count_delete_trigger ON comment')
      queryRunner.query('DROP FUNCTION IF EXISTS decrement_post_comment_count')
    }

}
