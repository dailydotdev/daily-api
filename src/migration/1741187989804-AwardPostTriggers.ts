import { MigrationInterface, QueryRunner } from 'typeorm';

export class AwardPostTriggers1741187989804 implements MigrationInterface {
  name = 'AwardPostTriggers1741187989804';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "awards" integer NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_post_award_insert_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW."awardTransactionId" IS NOT NULL THEN
              UPDATE post SET awards = awards + 1 WHERE id = NEW."postId";
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER user_post_award_insert_trigger
      AFTER INSERT ON user_post
      FOR EACH ROW
      EXECUTE FUNCTION user_post_award_insert_trigger_function();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_post_award_update_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD."awardTransactionId" IS NOT NULL AND NEW."awardTransactionId" IS NULL THEN
              UPDATE post SET awards = awards - 1 WHERE id = NEW."postId";
          ELSIF OLD."awardTransactionId" IS NULL AND NEW."awardTransactionId" IS NOT NULL THEN
              UPDATE post SET awards = awards + 1 WHERE id = NEW."postId";
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER user_post_award_update_trigger
      AFTER UPDATE ON user_post
      FOR EACH ROW
      EXECUTE FUNCTION user_post_award_update_trigger_function();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_post_award_delete_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD."awardTransactionId" IS NOT NULL THEN
              UPDATE post SET awards = awards - 1 WHERE id = OLD."postId";
          END IF;

          RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER user_post_award_delete_trigger
      AFTER DELETE ON user_post
      FOR EACH ROW
      EXECUTE FUNCTION user_post_award_delete_trigger_function();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "awards"`);

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_post_award_delete_trigger ON user_post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_post_award_delete_trigger_function()',
    );

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_post_award_update_trigger ON user_post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_post_award_update_trigger_function()',
    );

    await queryRunner.query(
      'DROP TRIGGER IF EXISTS user_post_award_insert_trigger ON user_post',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS user_post_award_insert_trigger',
    );
  }
}
