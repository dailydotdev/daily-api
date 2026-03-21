import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelHighlights1773000000000 implements MigrationInterface {
  name = 'ChannelHighlights1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ADD COLUMN "id" uuid DEFAULT uuid_generate_v4(),
        ADD COLUMN "highlightedAt" TIMESTAMP,
        ADD COLUMN "significance" smallint NOT NULL DEFAULT 0,
        ADD COLUMN "reason" text
    `);

    await queryRunner.query(/* sql */ `
      UPDATE "post_highlight" AS highlight
      SET
        "id" = COALESCE(highlight."id", uuid_generate_v4()),
        "highlightedAt" = COALESCE(
          highlight."highlightedAt",
          post."createdAt"
        )
      FROM "post" AS post
      WHERE post."id" = highlight."postId"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ALTER COLUMN "id" SET NOT NULL,
        ALTER COLUMN "highlightedAt" SET NOT NULL
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_post_highlight_channel_rank"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        DROP CONSTRAINT "PK_post_highlight"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ADD CONSTRAINT "PK_post_highlight"
          PRIMARY KEY ("id"),
        ADD CONSTRAINT "UQ_post_highlight_channel_post"
          UNIQUE ("channel", "postId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_post_highlight_channel_highlightedAt"
        ON "post_highlight" ("channel", "highlightedAt")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        DROP COLUMN "rank"
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "channel_highlight_definition" (
        "channel" text NOT NULL,
        "mode" text NOT NULL DEFAULT 'disabled',
        "targetAudience" text NOT NULL DEFAULT '',
        "candidateHorizonHours" smallint NOT NULL DEFAULT 72,
        "maxItems" smallint NOT NULL DEFAULT 10,
        "lastFetchedAt" TIMESTAMP,
        "lastPublishedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_highlight_definition_channel"
          PRIMARY KEY ("channel")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "channel_highlight_run" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" text NOT NULL,
        "scheduledAt" TIMESTAMP NOT NULL,
        "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        "status" text NOT NULL,
        "baselineSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "inputSummary" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "internalSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "comparison" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "metrics" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error" jsonb,
        CONSTRAINT "PK_channel_highlight_run_id"
          PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_channel_highlight_run_channel_scheduledAt"
        ON "channel_highlight_run" ("channel", "scheduledAt")
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "channel_highlight_definition" (
        "channel",
        "mode",
        "targetAudience",
        "candidateHorizonHours",
        "maxItems"
      )
      VALUES ('vibes', 'disabled', '', 72, 10)
      ON CONFLICT ("channel") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ADD COLUMN "rank" smallint
    `);

    await queryRunner.query(/* sql */ `
      WITH ranked_highlights AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "channel"
            ORDER BY "highlightedAt" DESC, "createdAt" DESC
          ) AS "rank"
        FROM "post_highlight"
      )
      UPDATE "post_highlight" AS highlight
      SET "rank" = ranked_highlights."rank"
      FROM ranked_highlights
      WHERE highlight."id" = ranked_highlights."id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ALTER COLUMN "rank" SET NOT NULL
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_channel_highlight_run_channel_scheduledAt"
    `);
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "channel_highlight_run"
    `);
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "channel_highlight_definition"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_post_highlight_channel_highlightedAt"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        DROP CONSTRAINT IF EXISTS "UQ_post_highlight_channel_post",
        DROP CONSTRAINT "PK_post_highlight"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        DROP COLUMN "reason",
        DROP COLUMN "significance",
        DROP COLUMN "highlightedAt",
        DROP COLUMN "id"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "post_highlight"
        ADD CONSTRAINT "PK_post_highlight"
          PRIMARY KEY ("channel", "postId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX "IDX_post_highlight_channel_rank"
        ON "post_highlight" ("channel", "rank")
    `);
  }
}
