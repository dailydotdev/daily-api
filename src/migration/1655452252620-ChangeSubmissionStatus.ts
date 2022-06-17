import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeSubmissionStatus1655452252620 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submission" ALTER COLUMN "status" SET DEFAULT 'STARTED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submission" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED'`,
    );
  }
}
