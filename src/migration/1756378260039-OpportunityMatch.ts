import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityMatch1756378260039 implements MigrationInterface {
  name = 'OpportunityMatch1756378260039'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity_match"(
        "opportunityId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "status" text NOT NULL DEFAULT 'pending',
        "description" jsonb NOT NULL DEFAULT '{}',
        "screening" jsonb NOT NULL DEFAULT '[]',
        "applicationRank" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_opportunity_match_opportunity_id_user_id" PRIMARY KEY ("opportunityId", "userId"),
        CONSTRAINT "FK_opportunity_match_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_opportunity_match_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_match_user_id" ON "opportunity_match" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes explicitly before dropping the table, as they were created explicitly.
    // Constraints (PK, FKs) defined within CREATE TABLE are dropped implicitly with the table.
    await queryRunner.query(/* sql */`
      DROP INDEX "public"."IDX_opportunity_match_user_id"
    `);
    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity_match"
    `);
  }
}
