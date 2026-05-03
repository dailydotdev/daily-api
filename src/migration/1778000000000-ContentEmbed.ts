import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentEmbed1778000000000 implements MigrationInterface {
  name = 'ContentEmbed1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "content_embed" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "parentType" text NOT NULL,
        "parentId" text NOT NULL,
        "referenceType" text NOT NULL,
        "referenceId" text NOT NULL,
        "url" text NOT NULL,
        "sortOrder" integer NOT NULL,
        "startOffset" integer NOT NULL,
        "endOffset" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_content_embed_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_content_embed_parent"
        ON "content_embed" ("parentType", "parentId")
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_content_embed_reference"
        ON "content_embed" ("referenceType", "referenceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE IF EXISTS "content_embed"
    `);
  }
}
