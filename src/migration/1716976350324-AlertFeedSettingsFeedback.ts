import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertFeedSettingsFeedback1716976350324
  implements MigrationInterface
{
  name = 'AlertFeedSettingsFeedback1716976350324';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "lastFeedSettingsFeedback" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `
        UPDATE  public.alerts AS a
        SET     "lastFeedSettingsFeedback" = u."createdAt"
        FROM    public.user AS u
        WHERE   u.id = a."userId"
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "lastFeedSettingsFeedback"`,
    );
  }
}
