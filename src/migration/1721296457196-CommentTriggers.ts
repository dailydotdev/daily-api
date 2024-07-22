import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentTriggers1721296457196 implements MigrationInterface {
    name = 'CommentTriggers1721296457196'

    public async up(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION increment_comment_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE comment SET comments = comments + 1 WHERE id = NEW."parentId";
          RETURN NEW;
        END;
        $$
      `)
      queryRunner.query('CREATE OR REPLACE TRIGGER increment_comment_count_create_trigger AFTER INSERT ON "comment" FOR EACH ROW WHEN (NEW."parentId" IS NOT NULL) EXECUTE PROCEDURE increment_comment_count()')
      queryRunner.query(`
        CREATE OR REPLACE FUNCTION decrement_comment_count()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE comment SET comments = comments - 1 WHERE id = OLD."parentId" AND comments > 0;
          RETURN OLD;
        END;
        $$
      `)
      queryRunner.query('CREATE OR REPLACE TRIGGER decrement_comment_count_delete_trigger AFTER DELETE ON "comment" FOR EACH ROW WHEN (OLD."parentId" IS NOT NULL) EXECUTE PROCEDURE decrement_comment_count()')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      queryRunner.query('DROP TRIGGER IF EXISTS increment_comment_count_create_trigger ON comment')
      queryRunner.query('DROP FUNCTION IF EXISTS increment_comment_count')
      queryRunner.query('DROP TRIGGER IF EXISTS decrement_comment_count_delete_trigger ON comment')
      queryRunner.query('DROP FUNCTION IF EXISTS decrement_comment_count')
    }

}
