import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsBanner1692536195223 implements MigrationInterface {
  name = 'AlertsBanner1692536195223';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "lastBanner" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "lastBanner"`);
  }
}
