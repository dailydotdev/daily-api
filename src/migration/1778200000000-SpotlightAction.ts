import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SpotlightAction1778200000000 implements MigrationInterface {
  name = 'SpotlightAction1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "spotlight_action" (
        "id" text NOT NULL,
        "group" text NOT NULL,
        "title" text NOT NULL,
        "subtitle" text,
        "icon" text NOT NULL,
        "keywords" text[] NOT NULL DEFAULT '{}',
        "shortcut" text,
        "quickKey" text,
        "requiresAuth" boolean NOT NULL DEFAULT false,
        "requiresPlus" boolean NOT NULL DEFAULT false,
        "platforms" text[],
        "kind" text NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "priority" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spotlight_action" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_spotlight_action_active_group_priority"
        ON "spotlight_action" ("active", "group", "priority")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_spotlight_action_active_group_priority"
    `);
    await queryRunner.query(/* sql */ `
      DROP TABLE "spotlight_action"
    `);
  }
}
