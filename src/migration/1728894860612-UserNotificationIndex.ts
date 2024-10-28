import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationIndex1728894860612 implements MigrationInterface {
  name = 'UserNotificationIndex1728894860612';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notification_userid_public_readat" ON "user_notification" ("userId", "public", "readAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notification_userid_public_readat"`,
    );
  }
}
