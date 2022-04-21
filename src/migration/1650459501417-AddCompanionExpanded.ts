import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanionExpanded1650459501417 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings"
      ADD "companionExpanded" boolean NULL DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "companionExpanded"`,
    );
  }
}
