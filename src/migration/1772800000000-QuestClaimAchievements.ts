import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestClaimAchievements1772800000000 implements MigrationInterface {
  name = 'QuestClaimAchievements1772800000000';

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
          'Bright eyed adventurer',
          'Complete 10 quests',
          'https://media.daily.dev/image/upload/s--HMBjgs_T--/q_auto/v1773743113/achievements/bright_eyed_adventurer',
          'milestone',
          'quest_claim',
          '{"targetCount": 10}',
          5
        ),
        (
          'On the path',
          'Complete 50 quests',
          'https://media.daily.dev/image/upload/s--iwqvFWLT--/q_auto/v1773743172/achievements/on_the_path',
          'milestone',
          'quest_claim',
          '{"targetCount": 50}',
          10
        ),
        (
          'Hero',
          'Complete 100 quests',
          'https://media.daily.dev/image/upload/s--5WqXv9y7--/q_auto/v1773743176/achievements/heros_quest',
          'milestone',
          'quest_claim',
          '{"targetCount": 100}',
          25
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "achievement"
      WHERE "name" IN (
        'Quest enthusiast',
        'Quest conqueror',
        'Quest legend'
      )
    `);
  }
}
