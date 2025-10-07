import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserExperienceRevamped1759421991433 implements MigrationInterface {
  name = 'UserExperienceRevamped1759421991433';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'api',
        'public',
        'user_skill',
        'GENERATED_COLUMN',
        'slug',
        "trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))",
      ],
    );
    await queryRunner.query(
      `CREATE TABLE "user_skill" ("slug" text GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))) STORED NOT NULL, "name" text NOT NULL, "description" text, CONSTRAINT "PK_user_skill_slug" PRIMARY KEY ("slug"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_skill_name" ON "user_skill" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dataset_location" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "country" character varying NOT NULL, "subdivision" text, "city" text, "iso2" character varying NOT NULL, "iso3" character varying NOT NULL, "timezone" character varying NOT NULL, "ranking" integer NOT NULL DEFAULT '0', "externalId" text, CONSTRAINT "PK_dataset_location_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_location_country_subdivision_city_unique" ON "dataset_location" ("country", "subdivision", "city") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_experience" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "companyId" text NOT NULL, "title" text NOT NULL, "subtitle" text, "description" text, "startedAt" TIMESTAMP NOT NULL, "endedAt" TIMESTAMP, "type" text NOT NULL, "locationId" uuid NOT NULL, "locationType" integer array NOT NULL DEFAULT '{1,2,3}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "employmentType" integer array DEFAULT '{1,2,3,4}', "verified" boolean DEFAULT false, "url" text, "grade" text, "externalReferenceId" text, CONSTRAINT "PK_user_experience_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_experience"."locationType" IS 'LocationType from protobuf schema'; COMMENT ON COLUMN "user_experience"."employmentType" IS 'EmploymentType from protobuf schema'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_experience_userId" ON "user_experience" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_experience_type" ON "user_experience" ("type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_experience_skill" ("slug" text NOT NULL, "experienceId" uuid NOT NULL, CONSTRAINT "PK_COMPOSITE_user_experience_skill_slug_experienceId" PRIMARY KEY ("slug", "experienceId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_user_experience_user_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_user_experience_company_companyId" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_user_experience_dataset_location_locationId" FOREIGN KEY ("locationId") REFERENCES "dataset_location"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience_skill" ADD CONSTRAINT "FK_user_experience_skill_user_skill_slug" FOREIGN KEY ("slug") REFERENCES "user_skill"("slug") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience_skill" ADD CONSTRAINT "FK_user_experience_skill_user_experience_experienceId" FOREIGN KEY ("experienceId") REFERENCES "user_experience"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "company" ADD "type" text NOT NULL DEFAULT 'company'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "type"`);
    await queryRunner.query(
      `ALTER TABLE "user_experience_skill" DROP CONSTRAINT "FK_user_experience_skill_user_experience_experienceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience_skill" DROP CONSTRAINT "FK_user_experience_skill_user_skill_slug"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" DROP CONSTRAINT "FK_user_experience_dataset_location_locationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" DROP CONSTRAINT "FK_user_experience_company_companyId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" DROP CONSTRAINT "FK_user_experience_user_userId"`,
    );
    await queryRunner.query(`DROP TABLE "user_experience_skill"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_experience_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_experience_userId"`);
    await queryRunner.query(`DROP TABLE "user_experience"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_location_country_subdivision_city_unique"`,
    );
    await queryRunner.query(`DROP TABLE "dataset_location"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_skill_name"`);
    await queryRunner.query(`DROP TABLE "user_skill"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      ['GENERATED_COLUMN', 'slug', 'api', 'public', 'user_skill'],
    );
  }
}
