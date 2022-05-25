import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsAddCompanion1653461379025 implements MigrationInterface {
  name = 'AlertsAddCompanion1653461379025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "addCompanion" boolean NULL`,
    );
    await queryRunner.query(
      `update "public"."alerts" set "addCompanion" = TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "addCompanion"`);
  }
}
