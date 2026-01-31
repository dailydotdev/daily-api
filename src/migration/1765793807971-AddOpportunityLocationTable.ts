import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpportunityLocationTable1765793807971
  implements MigrationInterface
{
  name = 'AddOpportunityLocationTable1765793807971';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "opportunity_location" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "opportunityId" uuid NOT NULL,
        "locationId" uuid NOT NULL,
        "type" integer NOT NULL,
        CONSTRAINT "PK_opportunity_location_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_opportunity_location_opportunity_opportunityId"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_opportunity_location_dataset_location_locationId"
          FOREIGN KEY ("locationId")
          REFERENCES "dataset_location"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      COMMENT ON COLUMN "opportunity_location"."type" IS 'LocationType from protobuf schema'
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_location_opportunityId"
        ON "opportunity_location" ("opportunityId")
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_location_locationId"
        ON "opportunity_location" ("locationId")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "opportunity"
        DROP COLUMN "location"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "opportunity"
        ADD "location" jsonb DEFAULT '[]'
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "opportunity_location"
    `);
  }
}
