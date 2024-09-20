import { MigrationInterface, QueryRunner } from "typeorm";

export class User1726691862710 implements MigrationInterface {
  name = 'User1726691862710'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "followingEmail" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "user" ADD "followNotifications" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "followNotifications"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "followingEmail"`);
  }
}
