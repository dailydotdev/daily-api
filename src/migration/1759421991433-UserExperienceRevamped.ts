import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserExperienceRevamped1759421991433 implements MigrationInterface {
  name = 'UserExperienceRevamped1759421991433';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE OR REPLACE FUNCTION slugify(text)
      RETURNS text AS $$
        SELECT trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT($1,100),''))), '[^a-z0-9-]+', '-', 'gi'))
      $$ LANGUAGE SQL IMMUTABLE;
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "dataset_location" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "country" character varying NOT NULL,
        "subdivision" text,
        "city" text,
        "iso2" character varying NOT NULL,
        "iso3" character varying NOT NULL,
        "timezone" character varying NOT NULL,
        "ranking" integer NOT NULL DEFAULT '0',
        "externalId" text,
        CONSTRAINT "PK_dataset_location_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_location_country_subdivision_city_unique" ON "dataset_location" ("country", "subdivision", "city")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_experience" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "companyId" text,
        "customCompanyName" text,
        "title" text NOT NULL,
        "subtitle" text,
        "description" text,
        "startedAt" TIMESTAMP NOT NULL,
        "endedAt" TIMESTAMP,
        "type" text NOT NULL,
        "locationId" uuid,
        "locationType" integer DEFAULT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "employmentType" integer DEFAULT NULL,
        "verified" boolean DEFAULT false,
        "url" text,
        "grade" text,
        "externalReferenceId" text,
        CONSTRAINT "PK_user_experience_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_experience_user_userId"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_experience_company_companyId"
          FOREIGN KEY ("companyId")
          REFERENCES "company"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_experience_dataset_location_locationId"
          FOREIGN KEY ("locationId")
          REFERENCES "dataset_location"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(/* sql */ `
      COMMENT ON COLUMN "user_experience"."locationType" IS 'LocationType from protobuf schema';
    `);

    await queryRunner.query(/* sql */ `
      COMMENT ON COLUMN "user_experience"."employmentType" IS 'EmploymentType from protobuf schema';
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_experience_userId" ON "user_experience" ("userId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_experience_type" ON "user_experience" ("type")
    `);

    await queryRunner.query(/* sql */ `
      CREATE TABLE "user_experience_skill" (
        "value" text NOT NULL,
        "experienceId" uuid NOT NULL,
        CONSTRAINT "PK_user_experience_value_experienceId" PRIMARY KEY ("value", "experienceId"),
        CONSTRAINT "FK_user_experience_skill_user_experience_experienceId"
          FOREIGN KEY ("experienceId")
          REFERENCES "user_experience"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_user_experience_skill_value_slugify" ON "public"."user_experience_skill" (slugify("value"))
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "company"
        ADD "type" text NOT NULL DEFAULT 'company'
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_company_name_lower" ON "public"."company" (LOWER("name"))
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_dataset_location_country_trgm"
        ON "public"."dataset_location"
        USING gin (country gin_trgm_ops)
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_dataset_location_city_trgm"
        ON "public"."dataset_location"
        USING gin (city gin_trgm_ops)
    `);
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_dataset_location_subdivision_trgm"
        ON "public"."dataset_location"
        USING gin (subdivision gin_trgm_ops)
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_dataset_location_iso2" ON "dataset_location" ("iso2")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_dataset_location_iso3" ON "dataset_location" ("iso3")
    `);

    await queryRunner.query(
      `ALTER TABLE "public"."comment" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."comment" REPLICA IDENTITY DEFAULT`,
    );

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_company_name_lower"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "company"
        DROP COLUMN "type"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "user_experience_skill"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "user_experience"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "dataset_location"
    `);

    await queryRunner.query(/* sql */ `
      DROP FUNCTION IF EXISTS slugify(text);
    `);
  }
}
