import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorldSetupAchievement1786000100000
  implements MigrationInterface
{
  name = 'AddWorldSetupAchievement1786000100000';

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
          'Terraformer',
          'Make your world your own',
          'https://media.daily.dev/image/upload/s--CV7PPCE0--/q_auto/v1786013739/achievements/terraformer',
          'instant',
          'world_setup',
          '{"targetCount": 1}',
          5
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "achievement"
      WHERE "name" = 'Terraformer'
    `);
  }
}
