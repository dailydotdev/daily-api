import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostTitleHtml1685957377259 implements MigrationInterface {
  name = 'PostTitleHtml1685957377259';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "titleHtml" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "titleHtml"`);
  }
}
