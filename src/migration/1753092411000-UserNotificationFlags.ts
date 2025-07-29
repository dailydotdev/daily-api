import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationFlags1753092411000 implements MigrationInterface {
  name = 'UserNotificationFlags1753092411000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notificationFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
    
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notificationFlags_gin" ON "user" USING GIN ("notificationFlags")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_notificationFlags_gin"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "notificationFlags"`);
  }
}