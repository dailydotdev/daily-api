import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityColumnType1757004361498 implements MigrationInterface {
  name = 'OpportunityColumnType1757004361498'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "type"`
    );
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "type" integer`
    );
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ALTER COLUMN "type" SET NOT NULL`
    );
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")`
    );
    await queryRunner.query(/* sql */`
      COMMENT ON COLUMN "opportunity"."type" IS 'OpportunityType from protobuf schema'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "type"`
    );
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "type" text`
    );
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")`
    );
  }
}
