import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShowFeedbackButton1770130160481 implements MigrationInterface {
  name = 'AddShowFeedbackButton1770130160481';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "showFeedbackButton" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "showFeedbackButton"`,
    );
  }
}
