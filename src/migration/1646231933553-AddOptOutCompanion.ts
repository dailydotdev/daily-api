import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOptOutCompanion1646231933553 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings"
      ADD "optOutCompanion" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "optOutCompanion"`,
    );
  }
}
