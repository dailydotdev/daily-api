import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityColumnName1758025199402 implements MigrationInterface {
  name = 'OpportunityColumnName1758025199402'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity"
        ADD COLUMN "opportunityType" integer
    `);
    await queryRunner.query(/* sql */`
      UPDATE "opportunity"
        SET "opportunityType" = "type"
        WHERE "opportunityType" IS NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity"
        ALTER COLUMN "opportunityType" SET NOT NULL
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."opportunityType" IS 'OpportunityType from protobuf schema'
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_opportunityType" ON "opportunity" ("opportunityType")
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity"
        DROP COLUMN "type"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_opportunity_opportunityType"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity"
        ADD "type" integer
    `);
    await queryRunner.query(/* sql */`
      UPDATE "opportunity"
        SET "type" = "opportunityType"
        WHERE "type" IS NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity"
        ALTER COLUMN "type" SET NOT NULL
    `);
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."type" IS 'OpportunityType from protobuf schema'
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity"
        DROP COLUMN "opportunityType"
    `);
  }
}
