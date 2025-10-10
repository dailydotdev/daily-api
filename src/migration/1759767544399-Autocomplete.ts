import { MigrationInterface, QueryRunner } from 'typeorm';

export class Autocomplete1759767544399 implements MigrationInterface {
  name = 'Autocomplete1759767544399';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `
      INSERT INTO "public"."typeorm_metadata"
        ("database", "schema", "table", "type", "name", "value")
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        'api',
        'public',
        'autocomplete',
        'GENERATED_COLUMN',
        'slug',
        "trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))",
      ],
    );

    await queryRunner.query(/* sql */ `
      CREATE TABLE "autocomplete" (
        "slug" text GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(value,100),''))), '[^a-z0-9-]+', '-', 'gi'))) STORED NOT NULL,
        "value" text NOT NULL,
        "type" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "enabled" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_autocomplete_type_slug" PRIMARY KEY ("type", "slug")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_autocomplete_slug_enabled_trgm"
        ON "public"."autocomplete"
        USING gin (slug gin_trgm_ops)
        WHERE enabled = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "autocomplete"
    `);

    await queryRunner.query(
      /* sql */ `
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "database" = $3
        AND "schema" = $4
        AND "table" = $5
      `,
      ['GENERATED_COLUMN', 'slug', 'api', 'public', 'autocomplete'],
    );
  }
}
