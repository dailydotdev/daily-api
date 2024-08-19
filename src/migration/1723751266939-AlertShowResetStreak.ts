import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertShowResetStreak1723751266939 implements MigrationInterface {
  name = 'AlertShowResetStreak1723751266939';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "showResetStreak" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "showResetStreak"`,
    );
  }
}
