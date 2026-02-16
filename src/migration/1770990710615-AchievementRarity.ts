import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementRarity1770990710615 implements MigrationInterface {
  name = 'AchievementRarity1770990710615';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "achievement" ADD "rarity" real`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "achievement" DROP COLUMN "rarity"`,
    );
  }
}
