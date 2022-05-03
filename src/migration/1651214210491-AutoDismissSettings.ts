import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoDismissSettings1651214210491 implements MigrationInterface {
  name = 'AutoDismissSettings1651214210491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "autoDismissNotifications" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "autoDismissNotifications"`,
    );
  }
}
