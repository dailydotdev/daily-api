import { MigrationInterface, QueryRunner } from "typeorm";

export class Question1756385612690 implements MigrationInterface {
  name = 'Question1756385612690'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "question"(
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" text NOT NULL,
        "title" text NOT NULL,
        "placeholder" text,
        "opportunityId" uuid,
        CONSTRAINT "PK_question_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_question_screening_opportunity_id"
          FOREIGN KEY ("opportunityId")
          REFERENCES "opportunity"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_question_type" ON "question" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "question"
    `);
  }
}
