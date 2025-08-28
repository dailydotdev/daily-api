import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidateAnswer1756386210527 implements MigrationInterface {
  name = 'UserCandidateAnswer1756386210527'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "user_candidate_answer"(
        "userId" character varying NOT NULL,
        "questionId" uuid NOT NULL,
        "answer" text NOT NULL,
        CONSTRAINT "PK_user_candidate_answer_user_id_question_id" PRIMARY KEY ("userId", "questionId"),
        CONSTRAINT "FK_user_candidate_answer_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_user_candidate_answer_question_id"
          FOREIGN KEY ("questionId")
          REFERENCES "question"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_user_candidate_answer_question_id" ON "user_candidate_answer" ("questionId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "user_candidate_answer"
    `);
  }
}
