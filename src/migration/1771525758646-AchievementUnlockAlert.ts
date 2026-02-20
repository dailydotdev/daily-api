import { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementUnlockAlert1771525758646
  implements MigrationInterface
{
  name = 'AchievementUnlockAlert1771525758646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD COLUMN "showAchievementUnlock" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "showAchievementUnlock"`,
    );
  }
}
