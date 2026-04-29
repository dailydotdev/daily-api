import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationEffectiveCreatedAt1777380340090
  implements MigrationInterface
{
  name = 'UserNotificationEffectiveCreatedAt1777380340090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS
        "IDX_user_notification_user_public_effective_created"
      ON "user_notification" (
        "userId",
        "public",
        (COALESCE("showAt", "createdAt")) DESC
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS
        "IDX_user_notification_user_public_effective_created"
    `);
  }
}
