import { MigrationInterface, QueryRunner } from 'typeorm';

export class SettingsCommentsAlgo1740757299661 implements MigrationInterface {
  name = 'SettingsCommentsAlgo1740757299661';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "sortCommentsBy" text NOT NULL DEFAULT 'oldest'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "sortCommentsBy"`,
    );
  }
}
