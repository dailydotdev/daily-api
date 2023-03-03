import { MigrationInterface, QueryRunner } from 'typeorm';

export class AvatarName1669735640941 implements MigrationInterface {
  name = 'AvatarName1669735640941';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_avatar"
      ADD "name" text NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_avatar" DROP COLUMN "name"`,
    );
  }
}
