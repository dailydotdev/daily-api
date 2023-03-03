import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationReference1670243653439 implements MigrationInterface {
  name = 'NotificationReference1670243653439';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification"
      ADD "referenceId" text`);
    await queryRunner.query(`ALTER TABLE "notification"
      ADD "referenceType" text`);
    await queryRunner.query(`ALTER TABLE "notification"
      ADD "uniqueKey" text DEFAULT '0'`);
    await queryRunner.query(`CREATE UNIQUE INDEX "ID_notification_uniqueness" ON "notification" ("type",
                                                                                                 "userId",
                                                                                                 "referenceId",
                                                                                                 "referenceType",
                                                                                                 "uniqueKey") `);
    await queryRunner.query(
      `CREATE INDEX "ID_notification_reference" ON "notification" ("referenceId", "referenceType") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."ID_notification_reference"`);
    await queryRunner.query(`DROP INDEX "public"."ID_notification_uniqueness"`);
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "uniqueKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "referenceType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "referenceId"`,
    );
  }
}
