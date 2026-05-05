import { MigrationInterface, QueryRunner } from 'typeorm';

export class Archive1775032000000 implements MigrationInterface {
  name = 'Archive1775032000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "archive" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subjectType" text NOT NULL,
        "rankingType" text NOT NULL,
        "scopeType" text NOT NULL,
        "scopeId" text,
        "periodType" text NOT NULL,
        "periodStart" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_archive_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_archive_lookup"
      ON "archive" (
        "subjectType",
        "rankingType",
        "scopeType",
        "scopeId",
        "periodType",
        "periodStart"
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_archive_lookup_unique"
      ON "archive" (
        "subjectType",
        "rankingType",
        "scopeType",
        COALESCE("scopeId", ''),
        "periodType",
        "periodStart"
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "archive_item" (
        "archiveId" uuid NOT NULL,
        "subjectId" text NOT NULL,
        "rank" integer NOT NULL,
        CONSTRAINT "PK_archive_item_archiveId_subjectId"
          PRIMARY KEY ("archiveId", "subjectId"),
        CONSTRAINT "FK_archive_item_archive"
          FOREIGN KEY ("archiveId")
          REFERENCES "archive" ("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_archive_item_archive_id_rank"
      ON "archive_item" ("archiveId", "rank")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_archive_item_archive_id_subject_id"
      ON "archive_item" ("archiveId", "subjectId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_archive_item_archive_id_subject_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_archive_item_archive_id_rank"`,
    );
    await queryRunner.query(`DROP TABLE "archive_item"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_archive_lookup_unique"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_archive_lookup"`);
    await queryRunner.query(`DROP TABLE "archive"`);
  }
}
