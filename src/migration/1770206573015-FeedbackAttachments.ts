import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackAttachments1770206573015 implements MigrationInterface {
  name = 'FeedbackAttachments1770206573015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feedback" ADD "screenshotUrl" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback" ADD "screenshotId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback" ADD "consoleLogs" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feedback" DROP COLUMN "consoleLogs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback" DROP COLUMN "screenshotId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback" DROP COLUMN "screenshotUrl"`,
    );
  }
}
