import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackCategoryInteger1769762715889 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback"`);
    await queryRunner.query(`
        CREATE TABLE "feedback" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" character varying(36) NOT NULL,
          "category" integer NOT NULL,
          "description" text NOT NULL,
          "pageUrl" text,
          "userAgent" text,
          "classification" jsonb,
          "linearIssueId" text,
          "linearIssueUrl" text,
          "status" integer NOT NULL DEFAULT 0,
          "flags" jsonb NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_feedback" PRIMARY KEY ("id"),
          CONSTRAINT "FK_feedback_user" FOREIGN KEY ("userId")
            REFERENCES "user"("id") ON DELETE CASCADE
        )
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_feedback_user_id" ON "feedback" ("userId")
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_feedback_status" ON "feedback" ("status")
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_feedback_created_at" ON "feedback" ("createdAt")
      `);
    await queryRunner.query(`
        COMMENT ON COLUMN "feedback"."category"
        IS 'UserFeedbackCategory from protobuf schema'
      `);
    await queryRunner.query(`
        COMMENT ON COLUMN "feedback"."status"
        IS 'FeedbackStatus enum internal'
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback"`);
    await queryRunner.query(`
        CREATE TABLE "feedback" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "userId" character varying(36) NOT NULL,
          "category" text NOT NULL,
          "description" text NOT NULL,
          "pageUrl" text,
          "userAgent" text,
          "classification" jsonb,
          "linearIssueId" text,
          "linearIssueUrl" text,
          "status" text NOT NULL DEFAULT 'pending',
          "flags" jsonb NOT NULL DEFAULT '{}',
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_feedback" PRIMARY KEY ("id"),
          CONSTRAINT "FK_feedback_user" FOREIGN KEY ("userId")
            REFERENCES "user"("id") ON DELETE CASCADE
        )
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_feedback_user_id" ON "feedback" ("userId")
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_feedback_status" ON "feedback" ("status")
      `);
    await queryRunner.query(`
        CREATE INDEX "IDX_feedback_created_at" ON "feedback" ("createdAt")
      `);
  }
}
