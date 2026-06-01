import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptOutAchievementsToSettings1779951714663
  implements MigrationInterface
{
  name = 'AddOptOutAchievementsToSettings1779951714663';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      ADD "optOutAchievements" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "settings"
      DROP COLUMN "optOutAchievements"
    `);
  }
}
