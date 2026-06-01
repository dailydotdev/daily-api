import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestRotationSeenAt1776100000000 implements MigrationInterface {
  name = 'QuestRotationSeenAt1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_quest_profile"
      ADD COLUMN "lastViewedQuestRotationsAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_quest_profile"
      DROP COLUMN "lastViewedQuestRotationsAt"
    `);
  }
}
