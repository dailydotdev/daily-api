import { MigrationInterface, QueryRunner } from "typeorm";

export class UserNotificationFlags1754302649060 implements MigrationInterface {
    name = 'UserNotificationFlags1754302649060'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notificationFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notificationFlags"`);
  }
  
}
