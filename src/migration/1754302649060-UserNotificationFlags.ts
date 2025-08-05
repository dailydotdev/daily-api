import { MigrationInterface, QueryRunner } from "typeorm";

export class UserNotificationFlags1754302649060 implements MigrationInterface {
    name = 'UserNotificationFlags1754302649060'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notificationFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
    
   await queryRunner.query(
      `CREATE INDEX "IDX_user_notificationFlags_path_ops" ON "user" USING GIN ("notificationFlags" jsonb_path_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_notificationFlags_path_ops"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notificationFlags"`);
  }
  
}
