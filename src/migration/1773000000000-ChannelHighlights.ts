import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelHighlights1773000000000 implements MigrationInterface {
  name = 'ChannelHighlights1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "channel_highlight_definition" (
        "channel" text NOT NULL,
        "mode" text NOT NULL DEFAULT 'disabled',
        "targetAudience" text NOT NULL DEFAULT '',
        "candidateHorizonHours" smallint NOT NULL DEFAULT 72,
        "maxItems" smallint NOT NULL DEFAULT 10,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_highlight_definition_channel"
          PRIMARY KEY ("channel")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "channel_highlight_state" (
        "channel" text NOT NULL,
        "lastFetchedAt" TIMESTAMP,
        "lastPublishedAt" TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_highlight_state_channel"
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
      DROP INDEX IF EXISTS "IDX_channel_highlight_run_channel_scheduledAt"
    `);
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "channel_highlight_run"
    `);
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "channel_highlight_state"
    `);
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "channel_highlight_definition"
    `);
  }
}
