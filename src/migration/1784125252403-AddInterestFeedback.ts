import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterestFeedback1784125252403 implements MigrationInterface {
  name = 'AddInterestFeedback1784125252403';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "interest_feedback" (
        "id" text NOT NULL,
        "interestId" text NOT NULL,
        "text" text NOT NULL,
        "appliedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fe7bff106604391a1def7b42073" PRIMARY KEY ("id"),
        CONSTRAINT "FK_700ac1d8df42619c86e580a5e70"
          FOREIGN KEY ("interestId")
          REFERENCES "user_interest"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_interest_feedback_interest_id_created"
        ON "interest_feedback" ("interestId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "interest_feedback"
    `);
  }
}
