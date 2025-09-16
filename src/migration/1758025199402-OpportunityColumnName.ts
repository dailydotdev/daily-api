import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityColumnName1758025199402 implements MigrationInterface {
  name = 'OpportunityColumnName1758025199402'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" RENAME COLUMN "type" TO "opportunityType"
    `);
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_opportunity_type"
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_opportunityType" ON "opportunity" ("opportunityType")
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity_user" RENAME COLUMN "type" TO "userType"
    `);
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_opportunity_user_type"
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_user_userType" ON "opportunity_user" ("userType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity_user" RENAME COLUMN "userType" TO "type"
    `);
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_opportunity_user_userType"
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_user_type" ON "opportunity_user" ("type")
    `);

    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" RENAME COLUMN "opportunityType" TO "type"
    `);
    await queryRunner.query(/* sql */`
      DROP INDEX IF EXISTS "IDX_opportunity_opportunityType"
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_type" ON "opportunity" ("type")
    `);
  }
}
