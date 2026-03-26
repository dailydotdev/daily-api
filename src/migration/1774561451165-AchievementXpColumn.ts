import { MigrationInterface, QueryRunner } from 'typeorm';

export class AchievementXpColumn1774561451165 implements MigrationInterface {
  name = 'AchievementXpColumn1774561451165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "achievement"
        ADD "xp" smallint NOT NULL DEFAULT '0'`,
    );

    await queryRunner.query(
      `UPDATE "achievement"
        SET "xp" = CASE "points"
          WHEN 5  THEN 10
          WHEN 10 THEN 25
          WHEN 15 THEN 40
          WHEN 20 THEN 60
          WHEN 25 THEN 100
          WHEN 30 THEN 150
          WHEN 40 THEN 250
          WHEN 50 THEN 350
          ELSE "points" * 2
        END`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "achievement"
        DROP COLUMN "xp"`,
    );
  }
}
