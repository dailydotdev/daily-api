import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEmailConfirmed1739429058124 implements MigrationInterface {
  name = 'UserEmailConfirmed1739429058124'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "emailConfirmed" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "emailConfirmed" SET DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "emailConfirmed"`);
  }
}
