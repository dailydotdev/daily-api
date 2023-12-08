import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationV21702045361925 implements MigrationInterface {
    name = 'NotificationV21702045361925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notification_attachment_v2" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" text NOT NULL, "image" text NOT NULL, "title" text NOT NULL, "referenceId" text NOT NULL, CONSTRAINT "PK_db01511a01f15c3df34e66d7f1a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_attch_v2_type_reference_id" ON "notification_attachment_v2" ("type", "referenceId") `);
        await queryRunner.query(`CREATE TABLE "notification_avatar_v2" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" text NOT NULL, "name" text NOT NULL, "image" text NOT NULL, "targetUrl" text NOT NULL, "referenceId" text NOT NULL, CONSTRAINT "PK_00519ec846ab51e5645e3da45e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_avatar_v2_type_reference_id" ON "notification_avatar_v2" ("type", "referenceId") `);
        await queryRunner.query(`CREATE TABLE "notification_v2" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" text NOT NULL, "icon" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "title" text NOT NULL, "description" text, "targetUrl" text NOT NULL, "public" boolean NOT NULL DEFAULT true, "referenceId" text, "referenceType" text, "uniqueKey" text NOT NULL DEFAULT '0', "numTotalAvatars" integer, "attachments" uuid array, "avatars" uuid array, CONSTRAINT "PK_232aefb4864403e6d84d48fc71e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "ID_notification_v2_uniq" ON "notification_v2" ("type", "referenceId", "referenceType", "uniqueKey") `);
        await queryRunner.query(`CREATE INDEX "ID_notification_v2_reference" ON "notification_v2" ("referenceId", "referenceType") `);
        await queryRunner.query(`CREATE TABLE "user_notification" ("notificationId" uuid NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "readAt" TIMESTAMP, "public" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_766785a5a35127ae6570088aa2d" PRIMARY KEY ("notificationId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_notification_user_id_read_at" ON "user_notification" ("userId", "readAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_notification_user_id_created_at" ON "user_notification" ("userId", "public", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_680af16b67e94e2cb693b9e9033" FOREIGN KEY ("notificationId") REFERENCES "notification_v2"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_dce2a8927967051c447ae10bc8b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_dce2a8927967051c447ae10bc8b"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_680af16b67e94e2cb693b9e9033"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_notification_user_id_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_notification_user_id_read_at"`);
        await queryRunner.query(`DROP TABLE "user_notification"`);
        await queryRunner.query(`DROP INDEX "public"."ID_notification_v2_reference"`);
        await queryRunner.query(`DROP INDEX "public"."ID_notification_v2_uniq"`);
        await queryRunner.query(`DROP TABLE "notification_v2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_avatar_v2_type_reference_id"`);
        await queryRunner.query(`DROP TABLE "notification_avatar_v2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_attch_v2_type_reference_id"`);
        await queryRunner.query(`DROP TABLE "notification_attachment_v2"`);
    }

}
