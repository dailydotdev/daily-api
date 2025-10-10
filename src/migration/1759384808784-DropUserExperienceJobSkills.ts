import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserExperienceJobSkills1759384808784
  implements MigrationInterface
{
  name = 'DropUserExperienceJobSkills1759384808784';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TABLE "user_experience_skills"`);
    await queryRunner.query(`DROP TABLE "user_experience"`);
    await queryRunner.query(`DROP TABLE "user_job_preferences"`);
    await queryRunner.query(`DROP TABLE "user_skill"`);
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`,
      ['GENERATED_COLUMN', 'slug', 'api', 'public', 'user_skill'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_skill" ("slug" text GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(name,100),''))), '[^a-z0-9-]+', '-', 'gi'))) STORED NOT NULL, "name" text NOT NULL, "description" text, CONSTRAINT "UQ_f9ace09ebfeeccdda4802b98392" UNIQUE ("name"), CONSTRAINT "PK_41832b06c6bd9241db033c9572b" PRIMARY KEY ("slug"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_job_preferences" ("userId" character varying NOT NULL, "openToOpportunities" boolean NOT NULL DEFAULT false, "preferredRoles" text array NOT NULL DEFAULT '{}', "preferredLocationType" text, "openToRelocation" boolean NOT NULL DEFAULT false, "currentTotalComp" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_fadf8207a17a3e0a367266cf8c9" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_experience" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "title" text NOT NULL, "description" text NOT NULL DEFAULT '', "startDate" date NOT NULL, "endDate" date, "type" text NOT NULL, "status" text NOT NULL DEFAULT 'draft', "flags" jsonb NOT NULL DEFAULT '{}', "companyId" text, "employmentType" text, "location" text, "locationType" text, "achievements" text array DEFAULT '{}', "verificationEmail" text, "verificationStatus" text, "publisher" text, "url" text, "contributors" text array DEFAULT '{}', "workingExperienceId" uuid, "educationExperienceId" uuid, "links" text array DEFAULT '{}', "schoolId" text, "fieldOfStudy" text, "grade" text, "extracurriculars" text, "courseNumber" text, "institution" text, "credentialId" text, "credentialUrl" text, "issuer" text, CONSTRAINT "REL_fc304c1e7340f2f6dcdd1df59c" UNIQUE ("workingExperienceId"), CONSTRAINT "REL_40370421b3ff16cb4c5074192e" UNIQUE ("educationExperienceId"), CONSTRAINT "PK_bdc1c40be8922c5cbcf5be466f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_49bab6e5332a852dedd2d26aee" ON "user_experience" ("type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_experience_skills" ("experienceId" uuid NOT NULL, "skillSlug" text NOT NULL, CONSTRAINT "PK_c60cb34d90719e6c251eade5ea2" PRIMARY KEY ("experienceId", "skillSlug"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_81852914f77ecea988f419beb2" ON "user_experience_skills" ("experienceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_148b0c2faa3d2d6571c0f8f0c3" ON "user_experience_skills" ("skillSlug") `,
    );
    await queryRunner.query(
      `ALTER TABLE "company" ADD "type" text NOT NULL DEFAULT 'business'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_job_preferences" ADD CONSTRAINT "FK_fadf8207a17a3e0a367266cf8c9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_7566e52259026584992211a40df" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_3f90b59b2b521e38d87c8f627dd" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_fc304c1e7340f2f6dcdd1df59ce" FOREIGN KEY ("workingExperienceId") REFERENCES "user_experience"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_40370421b3ff16cb4c5074192e3" FOREIGN KEY ("educationExperienceId") REFERENCES "user_experience"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD CONSTRAINT "FK_48330737fafe752bb82eb638b8e" FOREIGN KEY ("schoolId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience_skills" ADD CONSTRAINT "FK_81852914f77ecea988f419beb2d" FOREIGN KEY ("experienceId") REFERENCES "user_experience"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience_skills" ADD CONSTRAINT "FK_148b0c2faa3d2d6571c0f8f0c3b" FOREIGN KEY ("skillSlug") REFERENCES "user_skill"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" DROP COLUMN "links"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_experience" ADD "links" jsonb DEFAULT '[]'`,
    );
  }
}
