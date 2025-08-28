import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidateKeyword1756384950845 implements MigrationInterface {
  name = 'UserCandidateKeyword1756384950845'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "user_candidate_keyword"(
        "userId" character varying NOT NULL,
        "keyword" text NOT NULL,
        CONSTRAINT "PK_user_candidate_keyword_user_id_keyword" PRIMARY KEY ("userId", "keyword"),
        CONSTRAINT "FK_user_candidate_keywork_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "user_candidate_keyword"
    `);
  }
}
