import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostBookmarksCount1772500000000 implements MigrationInterface {
  name = 'PostBookmarksCount1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "bookmarks" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_bookmarks" ON "post" ("bookmarks")`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION increment_post_bookmark_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE post SET bookmarks = bookmarks + 1 WHERE id = NEW."postId";
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER increment_post_bookmark_count_create_trigger
        AFTER INSERT ON "bookmark"
        FOR EACH ROW
        EXECUTE PROCEDURE increment_post_bookmark_count()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION decrement_post_bookmark_count()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE post SET bookmarks = bookmarks - 1 WHERE id = OLD."postId" AND bookmarks > 0;
        RETURN OLD;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER decrement_post_bookmark_count_delete_trigger
        AFTER DELETE ON "bookmark"
        FOR EACH ROW
        EXECUTE PROCEDURE decrement_post_bookmark_count()
    `);
    await queryRunner.query(`
      UPDATE post
      SET bookmarks = (
        SELECT COUNT(*)
        FROM bookmark
        WHERE bookmark."postId" = post.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS increment_post_bookmark_count_create_trigger ON bookmark`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS increment_post_bookmark_count`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS decrement_post_bookmark_count_delete_trigger ON bookmark`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS decrement_post_bookmark_count`,
    );
    await queryRunner.query(`DROP INDEX "IDX_post_bookmarks"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "bookmarks"`);
  }
}
