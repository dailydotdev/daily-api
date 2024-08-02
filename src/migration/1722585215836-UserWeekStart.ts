import { MigrationInterface, QueryRunner } from "typeorm";

export class UserWeekStart1722585215836 implements MigrationInterface {
  name = 'UserWeekStart1722585215836'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "weekStart" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "weekStart"`);
  }
}
