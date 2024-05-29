import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertFeedSettingsFeedback1716976350324
  implements MigrationInterface
{
  name = 'AlertFeedSettingsFeedback1716976350324';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "lastFeedSettingsFeedback" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "lastFeedSettingsFeedback"`,
    );
  }
}
