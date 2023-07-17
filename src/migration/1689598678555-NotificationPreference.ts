import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreference1689598678555 implements MigrationInterface {
  name = 'NotificationPreference1689598678555';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_preference" ("userId" text NOT NULL, "notificationType" text NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "status" text NOT NULL, "postId" text, "sourceId" text, "commentId" character varying, CONSTRAINT "PK_dd257dfccc3dd38439cc79c861f" PRIMARY KEY ("userId", "notificationType", "postId", "sourceId", "commentId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65a9ca0600dbc72c6ff76501a6" ON "notification_preference" ("type") `,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_4953d54459dedcf97afe3c8c03d" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_43f03127c54baaae6d0fc649725" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" ADD CONSTRAINT "FK_0752f6682fb89a7dbad0d98434e" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_0752f6682fb89a7dbad0d98434e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_43f03127c54baaae6d0fc649725"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" DROP CONSTRAINT "FK_4953d54459dedcf97afe3c8c03d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65a9ca0600dbc72c6ff76501a6"`,
    );
    await queryRunner.query(`DROP TABLE "notification_preference"`);
  }
}
