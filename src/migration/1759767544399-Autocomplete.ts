import { MigrationInterface, QueryRunner } from 'typeorm';

export class Autocomplete1759767544399 implements MigrationInterface {
  name = 'Autocomplete1759767544399';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "autocomplete" (
        "value" text NOT NULL,
        "type" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "enabled" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_autocomplete_value_type" PRIMARY KEY ("value", "type")
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_autocomplete_value_enabled_trgm"
        ON "public"."autocomplete"
        USING gin (value gin_trgm_ops)
        WHERE enabled = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "autocomplete"
    `);
  }
}
