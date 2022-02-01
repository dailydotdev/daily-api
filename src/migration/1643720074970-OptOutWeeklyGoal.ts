import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptOutWeeklyGoal1643720074970 implements MigrationInterface {
  name = 'OptOutWeeklyGoal1643720074970';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings"
      ADD "optOutWeeklyGoal" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "optOutWeeklyGoal"`,
    );
  }
}
