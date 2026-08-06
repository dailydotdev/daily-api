import type { MigrationInterface, QueryRunner } from 'typeorm';

const questId = 'c7f0a1d4-2e6b-4b93-9f1a-8d3c5b7e0a42';

export class AddVisitUserWorldQuest1786000000000 implements MigrationInterface {
  name = 'AddVisitUserWorldQuest1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      INSERT INTO "quest" (
        "id",
        "name",
        "description",
        "type",
        "eventType",
        "criteria",
        "active"
      )
      VALUES
        (
          '${questId}',
          'Grand tour',
          'Visit 3 other users'' worlds',
          'daily',
          'visit_user_world',
          '{"targetCount": 3}',
          true
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      VALUES
        ('${questId}', 'xp', 15),
        ('${questId}', 'cores', 5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DELETE FROM "quest_reward"
      WHERE "questId" = '${questId}'
    `);

    await queryRunner.query(/* sql */ `
      DELETE FROM "quest"
      WHERE "id" = '${questId}'
    `);
  }
}
