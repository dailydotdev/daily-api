import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPreference1726149087071 implements MigrationInterface {
  name = 'ContentPreference1726149087071';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "content_preference" ("referenceId" text NOT NULL, "userId" character varying NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "status" text NOT NULL, "referenceUserId" text, CONSTRAINT "PK_3f50987656b7555fa8195d6f05b" PRIMARY KEY ("referenceId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09955119a32cc1d7a6e8be14c6" ON "content_preference" ("type") `,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" ADD "referenceUserId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "FK_231b13306df1d5046ffa7c4568b" FOREIGN KEY ("referenceUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "FK_c9c1cda086ffe214d856ab17522" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" ADD CONSTRAINT "FK_a6977adf724e068f6faae2914da" FOREIGN KEY ("referenceUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "FK_a6977adf724e068f6faae2914da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "FK_c9c1cda086ffe214d856ab17522"`,
    );
    await queryRunner.query(
      `ALTER TABLE "content_preference" DROP CONSTRAINT "FK_231b13306df1d5046ffa7c4568b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" DROP COLUMN "referenceUserId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_09955119a32cc1d7a6e8be14c6"`,
    );
    await queryRunner.query(`DROP TABLE "content_preference"`);
  }
}
