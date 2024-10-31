import { MigrationInterface, QueryRunner } from "typeorm";

export class AlertsTopReader1730379505031 implements MigrationInterface {
  name = 'AlertsTopReader1730379505031'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" ADD "topReaderBadge" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "topReaderBadge"`);
  }
}
