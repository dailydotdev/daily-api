import { MigrationInterface, QueryRunner } from "typeorm";

export class UserExperiences1753456498302 implements MigrationInterface {
    name = 'UserExperiences1753456498302'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_job_preferences" ("userId" character varying NOT NULL, "openToOpportunities" boolean NOT NULL DEFAULT false, "preferredRoles" text NOT NULL, "preferredLocationType" character varying, "openToRelocation" boolean NOT NULL DEFAULT false, "currentTotalComp" jsonb, CONSTRAINT "PK_fadf8207a17a3e0a367266cf8c9" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE TABLE "user_skill" ("slug" character varying NOT NULL, "name" text NOT NULL, "description" text, CONSTRAINT "UQ_f9ace09ebfeeccdda4802b98392" UNIQUE ("name"), CONSTRAINT "PK_41832b06c6bd9241db033c9572b" PRIMARY KEY ("slug"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_experience_type_enum" AS ENUM('work', 'education', 'project', 'certification', 'award', 'publication', 'course', 'open_source')`);
        await queryRunner.query(`CREATE TYPE "public"."user_experience_status_enum" AS ENUM('draft', 'published')`);
        await queryRunner.query(`CREATE TYPE "public"."user_experience_employmenttype_enum" AS ENUM('full_time', 'part_time', 'self_employed', 'freelance', 'contract', 'internship', 'apprenticeship', 'seasonal')`);
        await queryRunner.query(`CREATE TYPE "public"."user_experience_locationtype_enum" AS ENUM('remote', 'hybrid', 'on_site')`);
        await queryRunner.query(`CREATE TYPE "public"."user_experience_verificationstatus_enum" AS ENUM('pending', 'verified', 'failed')`);
        await queryRunner.query(`CREATE TABLE "user_experience" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "startDate" date NOT NULL, "endDate" date, "type" "public"."user_experience_type_enum" NOT NULL, "status" "public"."user_experience_status_enum" NOT NULL DEFAULT 'draft', "flags" jsonb NOT NULL DEFAULT '{}', "publisher" text, "url" text, "contributors" text DEFAULT '[]', "associatedWith" jsonb, "links" jsonb DEFAULT '[]', "companyId" text, "employmentType" "public"."user_experience_employmenttype_enum", "location" text, "locationType" "public"."user_experience_locationtype_enum", "achievements" text, "verificationEmail" text, "verificationStatus" "public"."user_experience_verificationstatus_enum", "schoolId" text, "fieldOfStudy" text, "grade" text, "extracurriculars" text, "courseNumber" text, "institution" text, "credentialId" text, "credentialUrl" text, "issuer" text, CONSTRAINT "PK_bdc1c40be8922c5cbcf5be466f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_49bab6e5332a852dedd2d26aee" ON "user_experience" ("type") `);
        await queryRunner.query(`CREATE TABLE "user_experience_skills" ("experienceId" uuid NOT NULL, "skillSlug" character varying NOT NULL, CONSTRAINT "PK_c60cb34d90719e6c251eade5ea2" PRIMARY KEY ("experienceId", "skillSlug"))`);
        await queryRunner.query(`CREATE INDEX "IDX_81852914f77ecea988f419beb2" ON "user_experience_skills" ("experienceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_148b0c2faa3d2d6571c0f8f0c3" ON "user_experience_skills" ("skillSlug") `);
        await queryRunner.query(`CREATE TYPE "public"."company_type_enum" AS ENUM('business', 'school')`);
        await queryRunner.query(`ALTER TABLE "company" ADD "type" "public"."company_type_enum" NOT NULL DEFAULT 'business'`);
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "memberPostingRank" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "source" ALTER COLUMN "memberInviteRank" DROP NOT NULL`);await queryRunner.query(`ALTER TABLE "user_experience" ADD CONSTRAINT "FK_7566e52259026584992211a40df" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_experience" ADD CONSTRAINT "FK_3f90b59b2b521e38d87c8f627dd" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_experience" ADD CONSTRAINT "FK_48330737fafe752bb82eb638b8e" FOREIGN KEY ("schoolId") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
       await queryRunner.query(`ALTER TABLE "user_experience_skills" ADD CONSTRAINT "FK_81852914f77ecea988f419beb2d" FOREIGN KEY ("experienceId") REFERENCES "user_experience"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_experience_skills" ADD CONSTRAINT "FK_148b0c2faa3d2d6571c0f8f0c3b" FOREIGN KEY ("skillSlug") REFERENCES "user_skill"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_experience" DROP CONSTRAINT "FK_48330737fafe752bb82eb638b8e"`);
        await queryRunner.query(`ALTER TABLE "user_experience" DROP CONSTRAINT "FK_3f90b59b2b521e38d87c8f627dd"`);
        await queryRunner.query(`ALTER TABLE "user_experience" DROP CONSTRAINT "FK_7566e52259026584992211a40df"`);
        await queryRunner.query(`ALTER TABLE "user_job_preferences" DROP CONSTRAINT "FK_fadf8207a17a3e0a367266cf8c9"`);
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."company_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_148b0c2faa3d2d6571c0f8f0c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_81852914f77ecea988f419beb2"`);
        await queryRunner.query(`DROP TABLE "user_experience_skills"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49bab6e5332a852dedd2d26aee"`);
        await queryRunner.query(`DROP TABLE "user_experience"`);
        await queryRunner.query(`DROP TYPE "public"."user_experience_verificationstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_experience_locationtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_experience_employmenttype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_experience_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_experience_type_enum"`);
        await queryRunner.query(`DROP TABLE "user_skill"`);
        await queryRunner.query(`DROP TABLE "user_job_preferences"`);
        }

}
