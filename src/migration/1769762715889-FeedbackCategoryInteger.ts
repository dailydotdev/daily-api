import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackCategoryInteger1769762715889 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert category column from text to integer
    await queryRunner.query(`
        ALTER TABLE "feedback"
        ALTER COLUMN "category" TYPE integer
        USING "category"::integer
      `);
    await queryRunner.query(`
        COMMENT ON COLUMN "feedback"."category"
        IS 'UserFeedbackCategory from protobuf schema'
      `);
    await queryRunner.query(`
        ALTER TABLE "feedback"
        ALTER COLUMN "status" TYPE integer
        USING "status"::integer
      `);
    await queryRunner.query(`
        ALTER TABLE "feedback"
        ALTER COLUMN "status" SET DEFAULT 1
      `);
    await queryRunner.query(`
        COMMENT ON COLUMN "feedback"."status"
        IS 'FeedbackStatus enum: 1=Pending, 2=Processing, 3=Completed, 4=Failed, 5=Spam'
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert status column to text
    await queryRunner.query(`
        COMMENT ON COLUMN "feedback"."status" IS NULL
      `);
    await queryRunner.query(`
        ALTER TABLE "feedback"
        ALTER COLUMN "status" DROP DEFAULT
      `);
    await queryRunner.query(`
        ALTER TABLE "feedback"
        ALTER COLUMN "status" SET DEFAULT 'pending'
      `);

    // Revert category column to text
    await queryRunner.query(`
        COMMENT ON COLUMN "feedback"."category" IS NULL
      `);
    await queryRunner.query(`
        ALTER TABLE "feedback"
        ALTER COLUMN "category" TYPE text
        USING "category"::text
      `);
  }
}
