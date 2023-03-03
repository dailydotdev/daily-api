import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsChangelog1675936666556 implements MigrationInterface {
  name = 'AlertsChangelog1675936666556';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "lastChangelog" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "lastChangelog"`);
  }
}
