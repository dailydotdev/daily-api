import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreferenceDefaults1757951380887 implements MigrationInterface {
  name = 'UserCandidatePreferenceDefaults1757951380887'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "employmentType" SET DEFAULT '{1,2,3,4}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "locationType" SET DEFAULT '{1,2,3}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "locationType" SET DEFAULT '{}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "employmentType" SET DEFAULT '{}'
    `);
  }
}
