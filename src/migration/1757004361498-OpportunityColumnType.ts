import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityColumnType1757004361498 implements MigrationInterface {
  name = 'OpportunityColumnType1757004361498'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."location" IS 'Location from protobuf schema'
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."content" IS 'OpportunityContent from protobuf schema'
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."meta" IS 'OpportunityMeta from protobuf schema'
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "type"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "type" integer
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ALTER COLUMN "type" SET NOT NULL
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."type" IS 'OpportunityType from protobuf schema'
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "size"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "size" integer
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "organization"."size" IS 'CompanySize from protobuf schema'
    `)

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "stage"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "stage" integer
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "organization"."stage" IS 'CompanyStage from protobuf schema'
    `);

    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."salaryExpectation" IS 'Salary from protobuf schema'
    `);

    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."location" IS 'Location from protobuf schema'
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "locationType"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "locationType" integer array
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."locationType" IS 'LocationType from protobuf schema'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" DROP COLUMN "locationType"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ADD "locationType" jsonb NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."location" IS NULL
    `);

    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "user_candidate_preference"."salaryExpectation" IS NULL
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "stage"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "stage" text
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" DROP COLUMN "size"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "organization" ADD "size" text
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "type"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "type" text
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")
    `);

    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."meta" IS NULL
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."content" IS NULL
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."location" IS NULL
    `);
  }
}
