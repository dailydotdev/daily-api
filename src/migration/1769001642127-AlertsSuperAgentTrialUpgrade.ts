import { MigrationInterface, QueryRunner } from "typeorm";

export class AlertsSuperAgentTrialUpgrade1769001642127 implements MigrationInterface {
  name = 'AlertsSuperAgentTrialUpgrade1769001642127'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" ADD "showSuperAgentTrialUpgrade" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "showSuperAgentTrialUpgrade"`);
  }
}
