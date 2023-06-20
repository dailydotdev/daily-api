import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostReportTags1687171948216 implements MigrationInterface {
  name = 'PostReportTags1687171948216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post_report" ADD "tags" text array`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post_report" DROP COLUMN "tags"`);
  }
}
