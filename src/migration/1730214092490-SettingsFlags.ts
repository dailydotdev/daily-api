import { MigrationInterface, QueryRunner } from 'typeorm';

export class SettingsFlags1730214092490 implements MigrationInterface {
  name = 'SettingsFlags1730214092490';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "flags"`);
  }
}
