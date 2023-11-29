import { MigrationInterface, QueryRunner } from 'typeorm';
import { AdvancedSettingsGroup } from '../entity';

export class AdvancedSettingsGroup1701211849318 implements MigrationInterface {
  name = 'AdvancedSettingsGroup1701211849318';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "advanced_settings" ADD "group" text NOT NULL DEFAULT 'advanced'`,
    );
    await queryRunner.query(
      `INSERT INTO "advanced_settings" ("title", "description", "group") VALUES ('Videos', 'Show video posts on my feed', '${AdvancedSettingsGroup.ContentTypes}')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "advanced_settings" DROP COLUMN "group"`,
    );
  }
}
