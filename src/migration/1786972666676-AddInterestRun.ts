import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterestRun1786972666676 implements MigrationInterface {
  name = 'AddInterestRun1786972666676';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "interest_run" (
        "id" text NOT NULL,
        "interestId" text NOT NULL,
        "status" text NOT NULL DEFAULT 'queued',
        "trigger" text NOT NULL DEFAULT 'scheduled',
        "feedbackId" text,
        "blocks" jsonb,
        "findingsAdded" integer NOT NULL DEFAULT '0',
        "summaryPostId" text,
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_interest_run" PRIMARY KEY ("id"),
        CONSTRAINT "FK_interest_run_interest_id"
          FOREIGN KEY ("interestId")
          REFERENCES "user_interest"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT "FK_interest_run_feedback_id"
          FOREIGN KEY ("feedbackId")
          REFERENCES "interest_feedback"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_interest_run_interest_id_created"
        ON "interest_run" ("interestId", "createdAt")
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
        ADD "lastRunStatus" text
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
        ADD "lastRunFindings" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
        DROP COLUMN "lastRunFindings"
    `);

    await queryRunner.query(/* sql */ `
      ALTER TABLE "user_interest"
        DROP COLUMN "lastRunStatus"
    `);

    await queryRunner.query(/* sql */ `
      DROP TABLE "interest_run"
    `);
  }
}
