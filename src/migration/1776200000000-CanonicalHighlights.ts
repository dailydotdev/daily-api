import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalHighlights1776200000000 implements MigrationInterface {
  name = 'CanonicalHighlights1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "post_highlight"
      RENAME TO "post_highlight_legacy"
    `);

    await queryRunner.query(`
      ALTER TABLE "post_highlight_legacy"
      RENAME CONSTRAINT "PK_post_highlight" TO "PK_post_highlight_legacy"
    `);

    await queryRunner.query(`
      ALTER TABLE "post_highlight_legacy"
      RENAME CONSTRAINT "FK_post_highlight_post" TO "FK_post_highlight_legacy_post"
    `);

    await queryRunner.query(`
      ALTER INDEX "IDX_post_highlight_post"
      RENAME TO "IDX_post_highlight_legacy_post"
    `);

    await queryRunner.query(`
      ALTER INDEX "IDX_post_highlight_retiredAt"
      RENAME TO "IDX_post_highlight_legacy_retiredAt"
    `);

    await queryRunner.query(`
      ALTER INDEX "UQ_post_highlight_channel_post"
      RENAME TO "UQ_post_highlight_legacy_channel_post"
    `);

    await queryRunner.query(`
      ALTER INDEX "IDX_post_highlight_active_channel_highlightedAt"
      RENAME TO "IDX_post_highlight_legacy_active_channel_highlightedAt"
    `);

    await queryRunner.query(`
      CREATE TABLE "post_highlight" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" text NOT NULL,
        "postId" text NOT NULL,
        "highlightedAt" TIMESTAMP NOT NULL,
        "headline" text NOT NULL,
        "significance" smallint NOT NULL DEFAULT 0,
        "retiredAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_highlight" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_highlight_post"
          FOREIGN KEY ("postId")
          REFERENCES "post"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "UQ_post_highlight_post" UNIQUE ("postId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_post"
        ON "post_highlight" ("postId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_active_significance_highlightedAt"
        ON "post_highlight" ("significance", "highlightedAt" DESC)
        WHERE "retiredAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_retiredAt"
        ON "post_highlight" ("retiredAt")
        WHERE "retiredAt" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "post_highlight_channel" (
        "highlightId" uuid NOT NULL,
        "channel" text NOT NULL,
        "placedAt" TIMESTAMP NOT NULL,
        "retiredAt" TIMESTAMP,
        CONSTRAINT "PK_post_highlight_channel" PRIMARY KEY ("highlightId", "channel"),
        CONSTRAINT "FK_post_highlight_channel_highlight"
          FOREIGN KEY ("highlightId")
          REFERENCES "post_highlight"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_channel_live_channel_placedAt"
        ON "post_highlight_channel" ("channel", "placedAt" DESC)
        WHERE "retiredAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_channel_retiredAt"
        ON "post_highlight_channel" ("retiredAt")
        WHERE "retiredAt" IS NOT NULL
    `);

    await queryRunner.query(`
      WITH canonical_rows AS (
        SELECT DISTINCT ON (legacy."postId")
          legacy."id",
          legacy."channel",
          legacy."postId",
          legacy."highlightedAt",
          legacy."headline",
          legacy."significance",
          CASE
            WHEN bool_or(legacy."retiredAt" IS NULL) OVER (
              PARTITION BY legacy."postId"
            )
            THEN NULL
            ELSE max(legacy."retiredAt") OVER (
              PARTITION BY legacy."postId"
            )
          END AS "retiredAt",
          legacy."createdAt",
          legacy."updatedAt"
        FROM "post_highlight_legacy" AS legacy
        ORDER BY
          legacy."postId",
          CASE WHEN legacy."retiredAt" IS NULL THEN 0 ELSE 1 END,
          legacy."highlightedAt" DESC,
          legacy."createdAt" DESC,
          legacy."id" DESC
      )
      INSERT INTO "post_highlight" (
        "id",
        "channel",
        "postId",
        "highlightedAt",
        "headline",
        "significance",
        "retiredAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        canonical."id",
        canonical."channel",
        canonical."postId",
        canonical."highlightedAt",
        canonical."headline",
        canonical."significance",
        canonical."retiredAt",
        canonical."createdAt",
        canonical."updatedAt"
      FROM canonical_rows AS canonical
    `);

    await queryRunner.query(`
      INSERT INTO "post_highlight_channel" (
        "highlightId",
        "channel",
        "placedAt",
        "retiredAt"
      )
      SELECT
        canonical."id",
        legacy."channel",
        legacy."highlightedAt",
        legacy."retiredAt"
      FROM "post_highlight_legacy" AS legacy
      INNER JOIN "post_highlight" AS canonical
        ON canonical."postId" = legacy."postId"
    `);

    await queryRunner.query(`
      DROP TABLE "post_highlight_legacy"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "post_highlight"
      RENAME TO "post_highlight_canonical"
    `);

    await queryRunner.query(`
      CREATE TABLE "post_highlight" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" text NOT NULL,
        "postId" text NOT NULL,
        "highlightedAt" TIMESTAMP NOT NULL,
        "headline" text NOT NULL,
        "significance" smallint NOT NULL DEFAULT 0,
        "reason" text,
        "retiredAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_highlight" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_highlight_post"
          FOREIGN KEY ("postId")
          REFERENCES "post"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_post"
        ON "post_highlight" ("postId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_active_channel_highlightedAt"
        ON "post_highlight" ("channel", "highlightedAt" DESC)
        WHERE "retiredAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_post_highlight_channel_post"
        ON "post_highlight" ("channel", "postId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_highlight_retiredAt"
        ON "post_highlight" ("retiredAt")
        WHERE "retiredAt" IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "post_highlight" (
        "id",
        "channel",
        "postId",
        "highlightedAt",
        "headline",
        "significance",
        "retiredAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        channel_row."highlightId",
        channel_row."channel",
        canonical."postId",
        channel_row."placedAt",
        canonical."headline",
        canonical."significance",
        channel_row."retiredAt",
        canonical."createdAt",
        canonical."updatedAt"
      FROM "post_highlight_channel" AS channel_row
      INNER JOIN "post_highlight_canonical" AS canonical
        ON canonical."id" = channel_row."highlightId"
    `);

    await queryRunner.query(`
      DROP TABLE "post_highlight_channel"
    `);

    await queryRunner.query(`
      DROP TABLE "post_highlight_canonical"
    `);
  }
}
