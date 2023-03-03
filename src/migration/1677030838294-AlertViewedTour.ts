import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertViewedTour1677030838294 implements MigrationInterface {
  name = 'AlertViewedTour1677030838294';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "squadTour" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "squadTour"`);
  }
}
