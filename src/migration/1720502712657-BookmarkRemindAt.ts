import { MigrationInterface, QueryRunner } from 'typeorm';

export class BookmarkRemindAt1720502712657 implements MigrationInterface {
  name = 'BookmarkRemindAt1720502712657';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookmark" ADD "remindAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookmark" DROP COLUMN "remindAt"`);
  }
}
