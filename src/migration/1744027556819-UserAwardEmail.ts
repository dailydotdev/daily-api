import { MigrationInterface, QueryRunner } from "typeorm";

export class UserAwardEmail1744027556819 implements MigrationInterface {
  name = 'UserAwardEmail1744027556819'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "awardEmail" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "user" ADD "awardNotifications" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "awardNotifications"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "awardEmail"`);
  }
}
