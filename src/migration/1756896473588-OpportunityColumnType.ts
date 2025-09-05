import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityColumnType1756896473588 implements MigrationInterface {
  name = 'OpportunityColumnType1756896473588'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "state"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "state" integer NOT NULL
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."state" IS 'OpportunityState from protobuf schema'
    `);


    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "public"."IDX_user_candidate_preference_status"
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "status"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "status" integer NOT NULL DEFAULT '1'
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."status" IS 'CandidateStatus from protobuf schema'
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "employmentType"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "employmentType" integer array
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."employmentType" IS 'EmploymentType from protobuf schema'
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "companyStage"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "companyStage" integer array
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."companyStage" IS 'CompanyStage from protobuf schema'
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "companySize"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "companySize" integer array
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."companySize" IS 'CompanySize from protobuf schema'
    `);


    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_user_candidate_preference_status" ON "user_candidate_preference" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "state"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "state" text
    `);


    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "public"."IDX_user_candidate_preference_status"
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "companySize"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "companySize" text array
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "companyStage"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "companyStage" text array
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "employmentType"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "employmentType" text array
    `);


    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "status"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "status" text NOT NULL DEFAULT '1'
    `);


    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_user_candidate_preference_status" ON "user_candidate_preference" ("status")
    `);
  }
}
