import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationV2Unique1702112901986 implements MigrationInterface {
    name = 'NotificationV2Unique1702112901986'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_avatar_v2_type_reference_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_attch_v2_type_reference_id"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_notification_avatar_v2_type_reference_id" ON "notification_avatar_v2" ("type", "referenceId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_notification_attch_v2_type_reference_id" ON "notification_attachment_v2" ("type", "referenceId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_attch_v2_type_reference_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_avatar_v2_type_reference_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_attch_v2_type_reference_id" ON "notification_attachment_v2" ("type", "referenceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_notification_avatar_v2_type_reference_id" ON "notification_avatar_v2" ("type", "referenceId") `);
    }

}
