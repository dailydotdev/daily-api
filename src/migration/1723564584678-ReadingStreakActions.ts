import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReadingStreakActions1723564584678 implements MigrationInterface {
  name = 'ReadingStreakActions1723564584678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reading_streak_actions" RENAME COLUMN "userStreakUserId" TO "userStreak"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reading_streak_actions" ADD CONSTRAINT "FK_f4c40ead8a139b0f261ec8591f4" FOREIGN KEY ("userStreak") REFERENCES "user_streak"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reading_streak_actions" RENAME COLUMN "userStreak" TO "userStreakUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reading_streak_actions" ADD CONSTRAINT "FK_f9fdcfffdde9bbb9fe59d40b56b" FOREIGN KEY ("userStreakUserId") REFERENCES "user_streak"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
