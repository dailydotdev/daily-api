import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationShowAt1772186714109 implements MigrationInterface {
  name = 'UserNotificationShowAt1772186714109';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notification" ADD "showAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_notification" DROP COLUMN "showAt"`,
    );
  }
}
