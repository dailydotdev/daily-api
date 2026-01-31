import { MigrationInterface, QueryRunner } from 'typeorm';

export class Feedback1769675835592 implements MigrationInterface {
  name = 'Feedback1769675835592';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        CONSTRAINT "PK_feedback" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_feedback_user_id" ON "feedback" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feedback_status" ON "feedback" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feedback_created_at" ON "feedback" ("createdAt")`,
    );

    await queryRunner.query(`
      ALTER TABLE "feedback"
      ADD CONSTRAINT "FK_feedback_user"
      FOREIGN KEY ("userId")
      REFERENCES "user"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feedback" DROP CONSTRAINT "FK_feedback_user"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_feedback_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_feedback_status"`);
    await queryRunner.query(`DROP INDEX "IDX_feedback_user_id"`);
    await queryRunner.query(`DROP TABLE "feedback"`);
  }
}
