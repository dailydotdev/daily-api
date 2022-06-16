import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubmissionEntity1651802478465 implements MigrationInterface {
  name = 'SubmissionEntity1651802478465';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "scoutId" character varying(36)`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD CONSTRAINT "FK_a51326b93176f2b2ebf3eda9fef" FOREIGN KEY ("scoutId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_scout" ON "post" ("scoutId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "submission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" text NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "status" character varying NOT NULL DEFAULT 'NOT_STARTED', "reason" text, CONSTRAINT "PK_submission_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7bd626272858ef6464aa257909" ON "submission" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "submission" ADD CONSTRAINT "FK_7bd626272858ef6464aa2579094" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "submission" REPLICA IDENTITY FULL`);
    await queryRunner.query(
      `INSERT INTO "public"."advanced_settings" ("title", "description") VALUES ('Community recommendations', 'Show posts that are recommended by other community members.')`,
    );
    const [settings] = await queryRunner.query(
      `SELECT "id" FROM "public"."advanced_settings" WHERE "title" = 'Community recommendations'`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "advancedSettings", "image") VALUES ('community', 'Community recommendations', '{${settings.id}}', 'https://res.cloudinary.com/daily-now/image/upload/t_logo,f_auto/v1/logos/community')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."advanced_settings" WHERE title = 'Community recommendations'`,
    );
    await queryRunner.query(
      `DELETE FROM "public"."source" WHERE id = 'community'`,
    );
    await queryRunner.query(
      `ALTER TABLE "post" DROP CONSTRAINT "FK_a51326b93176f2b2ebf3eda9fef"`,
    );
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "scoutId"`);
    await queryRunner.query(
      `ALTER TABLE "submission" REPLICA IDENTITY DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "submission" DROP CONSTRAINT "PK_submission_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_post_scout"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7bd626272858ef6464aa257909"`,
    );
    await queryRunner.query(`DROP TABLE "submission"`);
  }
}
