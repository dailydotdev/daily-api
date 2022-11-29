import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notification1669639147706 implements MigrationInterface {
  name = 'Notification1669639147706';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notification_attachment"
                             (
                               "notificationId" uuid    NOT NULL,
                               "order"          integer NOT NULL,
                               "type"           text    NOT NULL,
                               "image"          text    NOT NULL,
                               "title"          text    NOT NULL,
                               "referenceId"    text    NOT NULL,
                               CONSTRAINT "PK_d2f110b41b98a931e0f9a6caf97" PRIMARY KEY ("notificationId", "order")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_attch_id" ON "notification_attachment" ("notificationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_attch_type_reference_id" ON "notification_attachment" ("type", "referenceId") `,
    );
    await queryRunner.query(`CREATE TABLE "notification"
                             (
                               "id"          uuid                  NOT NULL DEFAULT uuid_generate_v4(),
                               "userId"      character varying(36) NOT NULL,
                               "type"        text                  NOT NULL,
                               "icon"        text                  NOT NULL,
                               "createdAt"   TIMESTAMP             NOT NULL DEFAULT now(),
                               "readAt"      TIMESTAMP,
                               "title"       text                  NOT NULL,
                               "description" text,
                               "targetUrl"   text                  NOT NULL,
                               "public"      boolean               NOT NULL DEFAULT true,
                               CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_id" ON "notification" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_id_read_at" ON "notification" ("userId", "readAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_id_created_at" ON "notification" ("userId", "createdAt", "public") `,
    );
    await queryRunner.query(`CREATE TABLE "notification_avatar"
                             (
                               "notificationId" uuid    NOT NULL,
                               "order"          integer NOT NULL,
                               "type"           text    NOT NULL,
                               "image"          text    NOT NULL,
                               "targetUrl"      text    NOT NULL,
                               "referenceId"    text    NOT NULL,
                               CONSTRAINT "PK_bcb2dddc35721dbc26996781082" PRIMARY KEY ("notificationId", "order")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_avatar_id" ON "notification_avatar" ("notificationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_avatar_type_reference_id" ON "notification_avatar" ("type", "referenceId") `,
    );
    await queryRunner.query(`ALTER TABLE "notification_attachment"
      ADD CONSTRAINT "FK_f74c03d05745ce57bf806d3600b" FOREIGN KEY ("notificationId") REFERENCES "notification" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notification"
      ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notification_avatar"
      ADD CONSTRAINT "FK_9be78f8137531744066459c3694" FOREIGN KEY ("notificationId") REFERENCES "notification" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(
      `ALTER TABLE "public"."notification" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_avatar" DROP CONSTRAINT "FK_9be78f8137531744066459c3694"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_attachment" DROP CONSTRAINT "FK_f74c03d05745ce57bf806d3600b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_avatar_type_reference_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_notification_avatar_id"`);
    await queryRunner.query(`DROP TABLE "notification_avatar"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_user_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_user_id_read_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_notification_user_id"`);
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notification_attch_id"`);
    await queryRunner.query(`DROP TABLE "notification_attachment"`);
  }
}
