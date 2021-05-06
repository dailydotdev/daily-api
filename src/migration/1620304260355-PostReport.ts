import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostReport1620304260355 implements MigrationInterface {
  name = 'PostReport1620304260355';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."post_report" ("postId" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reason" character varying(12) NOT NULL, CONSTRAINT "PK_b0df29b94d200adb86f5baf9cb6" PRIMARY KEY ("postId", "userId"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_report_post_id" ON "public"."post_report" ("postId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_report_user_id" ON "public"."post_report" ("userId") `,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_report_user_id"`,
      undefined,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_report_post_id"`,
      undefined,
    );
    await queryRunner.query(`DROP TABLE "public"."post_report"`, undefined);
  }
}
