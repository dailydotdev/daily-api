import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsDisplayCompanionPopup1653461379025
  implements MigrationInterface
{
  name = 'AlertsDisplayCompanionPopup1653461379025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "displayCompanionPopup" boolean NULL`,
    );
    await queryRunner.query(
      `update "public"."alerts" set "displayCompanionPopup" = TRUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "displayCompanionPopup"`,
    );
  }
}
