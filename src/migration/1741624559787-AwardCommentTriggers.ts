import { MigrationInterface, QueryRunner } from 'typeorm';

export class AwardCommentTriggers1741624559787 implements MigrationInterface {
  name = 'AwardCommentTriggers1741624559787';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comment" ADD "awards" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_comment_award_insert_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW."awardTransactionId" IS NOT NULL THEN
              UPDATE comment SET awards = awards + 1 WHERE id = NEW."commentId";
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER user_comment_award_insert_trigger
      AFTER INSERT ON user_comment
      FOR EACH ROW
      EXECUTE FUNCTION user_comment_award_insert_trigger_function();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_comment_award_update_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD."awardTransactionId" IS NOT NULL AND NEW."awardTransactionId" IS NULL THEN
              UPDATE comment SET awards = awards - 1 WHERE id = NEW."commentId";
          ELSIF OLD."awardTransactionId" IS NULL AND NEW."awardTransactionId" IS NOT NULL THEN
              UPDATE comment SET awards = awards + 1 WHERE id = NEW."commentId";
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER user_comment_award_update_trigger
      AFTER UPDATE ON user_comment
      FOR EACH ROW
      EXECUTE FUNCTION user_comment_award_update_trigger_function();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_comment_award_delete_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD."awardTransactionId" IS NOT NULL THEN
              UPDATE comment SET awards = awards - 1 WHERE id = OLD."commentId";
          END IF;

          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER user_comment_award_delete_trigger
      AFTER DELETE ON user_comment
      FOR EACH ROW
      EXECUTE FUNCTION user_comment_award_delete_trigger_function();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_comment_award_delete_trigger ON user_comment',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_comment_award_delete_trigger_function()',
    );

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_comment_award_update_trigger ON user_comment',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_comment_award_update_trigger_function()',
    );

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_comment_award_insert_trigger ON user_comment',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_comment_award_insert_trigger',
    );

    await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "awards"`);
  }
}
