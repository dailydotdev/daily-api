import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLongReadingStreakAchievements1779262012295 implements MigrationInterface {
  name = 'AddLongReadingStreakAchievements1779262012295';

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
          'Compiling a habit',
          'Reach a 512-day reading streak',
          'https://media.daily.dev/image/upload/s--OsjsEHN1--/v1779262629/achievements/Compiling_a_habit',
          'milestone',
          'reading_streak',
          '{"targetCount": 512}',
          50
        ),
        (
          'Big byte energy',
          'Reach a 1024-day reading streak',
          'https://media.daily.dev/image/upload/s--UV44P2mG--/v1779263302/achievements/big_byte_energy',
          'milestone',
          'reading_streak',
          '{"targetCount": 1024}',
          50
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "achievement"
      WHERE "eventType" = 'reading_streak'
        AND "name" IN ('Compiling a habit', 'Big byte energy')
    `);
  }
}
