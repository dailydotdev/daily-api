import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAwardGivenAchievements1770327354229
  implements MigrationInterface
{
  name = 'SeedAwardGivenAchievements1770327354229';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO "achievement" ("name", "description", "image", "type", "eventType", "criteria", "points")
        VALUES
          -- Award given achievements (giving awards)
          ('Altruistic', 'Give your first award', '', 'milestone', 'award_given', '{"targetCount": 1}', 10),
          ('The giver', 'Give 5 awards', '', 'milestone', 'award_given', '{"targetCount": 5}', 20),
          ('The head of the committee', 'Give 10 awards', '', 'milestone', 'award_given', '{"targetCount": 10}', 30)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "achievement" WHERE "eventType" = 'award_given'`,
    );
  }
}
