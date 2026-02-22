import { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementUnit1771350000000 implements MigrationInterface {
  name = 'AchievementUnit1771350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "achievement" ADD COLUMN "unit" text DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "achievement" DROP COLUMN "unit"`);
  }
}
