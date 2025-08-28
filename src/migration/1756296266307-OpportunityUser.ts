import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityUser1756296266307 implements MigrationInterface {
  name = 'OpportunityUser1756296266307'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity_user"(
        "opportunityId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "type" text NOT NULL,
        CONSTRAINT "PK_opportunity_user" PRIMARY KEY ("opportunityId", "userId"),
        CONSTRAINT "FK_opportunity_user_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_opportunity_user_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_user_user_id" ON "opportunity_user" ("userId")
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_opportunity_user_type" ON "opportunity_user" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity_user"
    `);
  }
}
