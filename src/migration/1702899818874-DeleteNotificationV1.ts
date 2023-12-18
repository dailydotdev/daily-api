import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeleteNotificationV11702899818874 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_attachment"`);
    await queryRunner.query(`DROP TABLE "notification_avatar"`);
    await queryRunner.query(`DROP TABLE "notification"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
