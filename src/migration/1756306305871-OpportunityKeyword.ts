import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityKeyword1756306305871 implements MigrationInterface {
  name = 'OpportunityKeyword1756306305871'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "opportunity_keyword"(
        "opportunityId" uuid NOT NULL,
        "keyword" text NOT NULL,
        CONSTRAINT "PK_opportunity_keyword_opportunity_id_keyword" PRIMARY KEY ("opportunityId", "keyword"),
        CONSTRAINT "FK_opportunity_keyword_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "opportunity_keyword"
    `);
  }
}
