import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategorySlug1726556744920 implements MigrationInterface {
  name = 'SourceCategorySlug1726556744920';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "source_category" ADD "slug" text GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(source_category.title,100),'')||'-'||source_category.id)), '[^a-z0-9-]+', '-', 'gi'))) STORED NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "source_category" ADD CONSTRAINT "UQ_c8617f90869d1b40e49f494a460" UNIQUE ("slug")`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'api',
        'public',
        'source_category',
        'GENERATED_COLUMN',
        'slug',
        "trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(source_category.title,100),'')||'-'||source_category.id)), '[^a-z0-9-]+', '-', 'gi'))",
      ],
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_source_category_slug" ON "source_category" ("slug") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_source_category_slug"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      ['GENERATED_COLUMN', 'slug', 'api', 'public', 'source_category'],
    );
    await queryRunner.query(
      `ALTER TABLE "source_category" DROP CONSTRAINT "UQ_c8617f90869d1b40e49f494a460"`,
    );
    await queryRunner.query(`ALTER TABLE "source_category" DROP COLUMN "slug"`);
  }
}
