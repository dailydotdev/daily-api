import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMoreReadingStreakAchievements1783416206466 implements MigrationInterface {
  name = 'AddMoreReadingStreakAchievements1783416206466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "achievement" (
        "name",
        "description",
        "image",
        "type",
        "eventType",
        "criteria",
        "points"
      )
      VALUES
        (
          'What time is it?',
          'Reach a 67-day reading streak',
          'https://media.daily.dev/image/upload/s--2bqSyiqr--/v1783416166/achievements/What_time_is_it',
          'milestone',
          'reading_streak',
          '{"targetCount": 67}',
          35
        ),
        (
          'Devil is impressed',
          'Reach a 666-day reading streak',
          'https://media.daily.dev/image/upload/s--W0-BqBQd--/v1783416167/achievements/Devil_is_impressed',
          'milestone',
          'reading_streak',
          '{"targetCount": 666}',
          50
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "achievement"
      WHERE "eventType" = 'reading_streak'
        AND "name" IN ('What time is it?', 'Devil is impressed')
    `);
  }
}
