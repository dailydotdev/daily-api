import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationV2PostAddedUnique1727870383565
  implements MigrationInterface
{
  name = 'NotificationV2PostAddedUnique1727870383565';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_notification_v2_post_added_unique" ON "notification_v2" ("referenceId", "referenceType") WHERE type IN ('user_post_added', 'source_post_added', 'squad_post_added')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_v2_post_added_unique"`,
    );
  }
}
