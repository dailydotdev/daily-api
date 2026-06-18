import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPostHighlight1782000000000 implements MigrationInterface {
  name = 'DropPostHighlight1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "post_highlight"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "post_highlight" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" text NOT NULL,
        "postId" text NOT NULL,
        "highlightedAt" timestamp NOT NULL,
        "headline" text NOT NULL,
        "significance" smallint NOT NULL DEFAULT '0',
        "reason" text,
        "retiredAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_highlight"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_highlight_channel_post"
          UNIQUE ("channel", "postId"),
        CONSTRAINT "FK_post_highlight_post"
          FOREIGN KEY ("postId")
          REFERENCES "post"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_highlight_post"
        ON "post_highlight" ("postId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_highlight_active_channel_highlightedAt"
        ON "post_highlight" ("channel", "highlightedAt")
        WHERE "retiredAt" IS NULL
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_highlight_retiredAt"
        ON "post_highlight" ("retiredAt")
        WHERE "retiredAt" IS NOT NULL
    `);
  }
}
