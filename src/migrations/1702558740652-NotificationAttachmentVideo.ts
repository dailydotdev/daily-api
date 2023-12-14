import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationAttachmentVideo1702558740652
  implements MigrationInterface
{
  name = 'NotificationAttachmentVideo1702558740652';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_attachment_v2" ADD "isAttachmentVideo" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_attachment_v2" DROP COLUMN "isAttachmentVideo"`,
    );
  }
}
