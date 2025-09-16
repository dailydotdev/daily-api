import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreferenceCustomKeywords1757944812451 implements MigrationInterface {
  name = 'UserCandidatePreferenceCustomKeywords1757944812451'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ADD "customKeywords" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        DROP COLUMN "customKeywords"
    `);
  }
}
