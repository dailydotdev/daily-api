import { MigrationInterface, QueryRunner } from 'typeorm';

const questId = '90401648-7bb2-455d-a087-14fc64aba1b1';

export class AddWatercoolerQuest1785660000000 implements MigrationInterface {
  name = 'AddWatercoolerQuest1785660000000';

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
          'Off the clock',
          'Visit the Watercooler feed',
          'daily',
          'visit_watercooler_feed',
          '{"targetCount": 1}',
          true
        )
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "quest_reward" ("questId", "type", "amount")
      VALUES
        ('${questId}', 'xp', 10),
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
