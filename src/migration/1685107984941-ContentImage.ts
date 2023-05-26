import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentImage1685107984941 implements MigrationInterface {
  name = 'ContentImage1685107984941';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "content_image"
                             (
                               "url"          text      NOT NULL,
                               "serviceId"    text      NOT NULL,
                               "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
                               "shouldDelete" boolean   NOT NULL DEFAULT true,
                               CONSTRAINT "PK_cdb1a9bda3f2b075569540e0132" PRIMARY KEY ("url")
                             )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_content_image_created_at" ON "content_image" ("createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."content_image" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_content_image_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "content_image"`);
  }
}
