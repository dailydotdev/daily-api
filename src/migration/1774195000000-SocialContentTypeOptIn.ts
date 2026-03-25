import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialContentTypeOptIn1774195000000
  implements MigrationInterface
{
  name = 'SocialContentTypeOptIn1774195000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE advanced_settings
      SET "defaultEnabledState" = FALSE
      WHERE "group" = 'content_types'
        AND options->>'type' = 'social:twitter'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE advanced_settings
      SET "defaultEnabledState" = TRUE
      WHERE "group" = 'content_types'
        AND options->>'type' = 'social:twitter'
    `);
  }
}
