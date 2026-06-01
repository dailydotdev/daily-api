import type { MigrationInterface, QueryRunner } from 'typeorm';

export class StandupsContentTypeAdvancedSetting1779100000000 implements MigrationInterface {
  name = 'StandupsContentTypeAdvancedSetting1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "advanced_settings" (
        "title",
        "description",
        "group",
        "options"
      )
      SELECT
        'Standups',
        'Live standup posts hosted on daily.dev.',
        'content_types',
        '{"type": "live_room"}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1
        FROM "advanced_settings"
        WHERE "group" = 'content_types'
          AND "options"->>'type' = 'live_room'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "advanced_settings"
      WHERE "title" = 'Standups'
        AND "group" = 'content_types'
        AND "options"->>'type' = 'live_room'
    `);
  }
}
