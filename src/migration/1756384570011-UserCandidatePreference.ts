import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreference1756384570011 implements MigrationInterface {
  name = 'UserCandidatePreference1756384570011'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE TABLE "user_candidate_preference"(
        "userId" character varying NOT NULL,
        "status" text NOT NULL DEFAULT 'disabled',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "cv" jsonb NOT NULL DEFAULT '{}',
        "cvParsed" jsonb NOT NULL DEFAULT '{}',
        "role" text,
        "roleType" double precision NOT NULL DEFAULT '0.5',
        "employmentType" text array,
        "salaryExpectation" jsonb NOT NULL DEFAULT '{}',
        "location" jsonb NOT NULL DEFAULT '[]',
        "locationType" jsonb NOT NULL DEFAULT '{}',
        "companyStage" text array,
        "companySize" text array,
        CONSTRAINT "PK_user_candidate_preference_user_id" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_user_candidate_preference_user_id"
          FOREIGN KEY ("userId")
          REFERENCES "user"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP TABLE "user_candidate_preference"
    `);
  }
}
