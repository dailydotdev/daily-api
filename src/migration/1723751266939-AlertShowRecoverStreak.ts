import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertShowRecoverStreak1723751266939 implements MigrationInterface {
  name = 'AlertShowRecoverStreak1723751266939';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "showRecoverStreak" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "showRecoverStreak"`,
    );
  }
}
