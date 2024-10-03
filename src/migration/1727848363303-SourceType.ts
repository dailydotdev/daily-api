import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceType1727848363303 implements MigrationInterface {
  name = 'SourceType1727848363303';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO advanced_settings
        ("title", "description", "group", "options")
        VALUES
        ('Squads', 'Developer-created posts from various Squads on the platform.', 'source_types', '{"type": "squad"}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM advanced_settings WHERE "group" = 'source_types'`,
    );
  }
}
