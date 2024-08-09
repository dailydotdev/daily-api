import { MigrationInterface, QueryRunner } from "typeorm";

export class SubmissionFlags1723135865854 implements MigrationInterface {
  name = 'SubmissionFlags1723135865854'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "submission" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "submission" DROP COLUMN "flags"`);
  }
}
