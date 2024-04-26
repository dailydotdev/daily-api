import { MigrationInterface, QueryRunner } from 'typeorm';

export class LastBootPopup1714045647906 implements MigrationInterface {
  name = 'LastBootPopup1714045647906';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "lastBootPopup" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "lastBootPopup"`);
  }
}
