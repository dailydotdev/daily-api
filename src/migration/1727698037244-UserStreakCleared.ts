import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakCleared1727698037244 implements MigrationInterface {
  name = 'UserStreakCleared1727698037244';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_streak" ADD "lastClearedAt" TIMESTAMP`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_cleared_timestamp_on_clear()
        RETURNS TRIGGER
        LANGUAGE PLPGSQL
        AS
      $$
      BEGIN
        UPDATE  user_streak
        SET     "lastClearedAt" = NOW()
        WHERE   "userId" = NEW."userId";
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(
      `
      CREATE OR REPLACE TRIGGER update_cleared_timestamp_on_clear
      AFTER UPDATE ON "user_streak"
      FOR EACH ROW
      WHEN (NEW."currentStreak" = 0 AND OLD."currentStreak" > 0)
      EXECUTE PROCEDURE update_cleared_timestamp_on_clear()
    `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_cleared_timestamp_on_clear ON user_streak',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS update_cleared_timestamp_on_clear',
    );
    await queryRunner.query(
      `ALTER TABLE "user_streak" DROP COLUMN "lastClearedAt"`,
    );
  }
}
