import type { MigrationInterface, QueryRunner } from 'typeorm';

export class HighlightsCanonical1779088410388 implements MigrationInterface {
  name = 'HighlightsCanonical1779088410388';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "highlights_canonical" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" text NOT NULL,
        "channels" text[] NOT NULL DEFAULT '{}'::text[],
        "highlightedAt" TIMESTAMP NOT NULL,
        "headline" text NOT NULL,
        "significance" smallint NOT NULL DEFAULT '0',
        "reason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_highlights_canonical_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_highlights_canonical_post"
          FOREIGN KEY ("postId")
          REFERENCES "post"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_highlights_canonical_post"
        ON "highlights_canonical" ("postId")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_highlights_canonical_highlightedAt"
        ON "highlights_canonical" ("highlightedAt")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_highlights_canonical_channels"
        ON "highlights_canonical" USING GIN ("channels")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "highlights_canonical"
    `);
  }
}
