import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailNotificationPreference1671161744023
  implements MigrationInterface
{
  name = 'EmailNotificationPreference1671161744023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "notificationEmail" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "notificationEmail"`,
    );
  }
}
