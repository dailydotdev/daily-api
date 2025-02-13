import { MigrationInterface, QueryRunner } from "typeorm";

export class UserDropProfileConfirmed1739337003828 implements MigrationInterface {
  name = 'UserDropProfileConfirmed1739337003828'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "profileConfirmed"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "profileConfirmed" boolean NOT NULL DEFAULT false`);
  }
}
