import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeedbackStatusExpand1770017049120 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remap old status values to new values
    // Old: Pending=0, Processing=1, Completed=2, Failed=3, Spam=4
    // New: Pending=0, Processing=1, Accepted=2, Completed=3, Cancelled=4, Failed=5, Spam=6
    //
    // We must update in reverse order to avoid conflicts:
    // 4 (Spam) → 6
    // 3 (Failed) → 5
    // 2 (Completed) → 3
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 6
      WHERE "status" = 4
    `);
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 5
      WHERE "status" = 3
    `);
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 3
      WHERE "status" = 2
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse mapping
    // 3 (Completed) → 2
    // 5 (Failed) → 3
    // 6 (Spam) → 4
    // Note: Accepted(2) and Cancelled(4) cannot be mapped back, they don't exist in old schema
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 2
      WHERE "status" = 3
    `);
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 3
      WHERE "status" = 5
    `);
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 4
      WHERE "status" = 6
    `);
    // Set Accepted(2) and Cancelled(4) back to Pending(0) as fallback
    await queryRunner.query(`
      UPDATE "feedback"
      SET "status" = 0
      WHERE "status" IN (2, 4)
    `);
  }
}
