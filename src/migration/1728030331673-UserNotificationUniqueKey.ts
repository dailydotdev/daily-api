import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationUniqueKey1728030331673
  implements MigrationInterface
{
  name = 'UserNotificationUniqueKey1728030331673';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notification" ADD "uniqueKey" text`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_notification_userId_uniqueKey_unique" ON "user_notification" ("userId", "uniqueKey") WHERE "uniqueKey" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notification_userId_uniqueKey_unique"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notification" DROP COLUMN "uniqueKey"`,
    );
  }
}
