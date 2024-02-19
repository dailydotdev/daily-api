import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReadingStreaksAlert1708024370161 implements MigrationInterface {
  name = 'ReadingStreaksAlert1708024370161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "showStreakMilestone" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "showStreakMilestone"`,
    );
  }
}
