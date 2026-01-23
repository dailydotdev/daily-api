import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStackIcon1768921813120 implements MigrationInterface {
  name = 'AddUserStackIcon1768921813120';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_stack" ADD "icon" text`);
    await queryRunner.query(`ALTER TABLE "user_stack" ADD "title" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_stack" DROP COLUMN "title"`);
    await queryRunner.query(`ALTER TABLE "user_stack" DROP COLUMN "icon"`);
  }
}
