import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackReply1772600000000 implements MigrationInterface {
  name = 'FeedbackReply1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feedback_reply" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "feedbackId" uuid NOT NULL,
        "body" text NOT NULL,
        "authorName" text,
        "authorEmail" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback_reply_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_feedback_reply_feedback_id"
      ON "feedback_reply" ("feedbackId")
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_reply"
      ADD CONSTRAINT "FK_feedback_reply_feedback_id"
      FOREIGN KEY ("feedbackId")
      REFERENCES "feedback"("id")
      ON DELETE CASCADE
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback_reply"
      DROP CONSTRAINT "FK_feedback_reply_feedback_id"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."IDX_feedback_reply_feedback_id"
    `);

    await queryRunner.query(`
      DROP TABLE "feedback_reply"
    `);
  }
}
