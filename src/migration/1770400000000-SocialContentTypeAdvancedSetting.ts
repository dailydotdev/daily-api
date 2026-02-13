import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialContentTypeAdvancedSetting1770400000000
  implements MigrationInterface
{
  name = 'SocialContentTypeAdvancedSetting1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO advanced_settings
        ("title", "description", "group", "options")
        VALUES
        ('Social', 'Posts from social platforms, including tweets and threads shared on daily.dev.', 'content_types', '{"type": "social:twitter"}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM advanced_settings
        WHERE "title" = 'Social'
          AND "group" = 'content_types'
          AND options->>'type' = 'social:twitter'`,
    );
  }
}
