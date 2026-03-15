import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGamificationSettings1772100000000
  implements MigrationInterface
{
  name = 'AddGamificationSettings1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD "optOutLevelSystem" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD "optOutQuestSystem" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      DROP COLUMN "optOutQuestSystem"
    `);
    await queryRunner.query(`
      ALTER TABLE "settings"
      DROP COLUMN "optOutLevelSystem"
    `);
  }
}
