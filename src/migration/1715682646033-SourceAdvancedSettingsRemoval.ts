import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceAdvancedSettingsRemoval1715682646033
  implements MigrationInterface
{
  name = 'SourceAdvancedSettingsRemoval1715682646033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" DROP COLUMN "advancedSettings"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source" ADD "advancedSettings" integer array DEFAULT '{}'`,
    );
  }
}
