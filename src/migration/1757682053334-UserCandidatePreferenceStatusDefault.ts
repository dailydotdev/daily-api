import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreferenceStatusDefault1757682053334 implements MigrationInterface {
  name = 'UserCandidatePreferenceStatusDefault1757682053334'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "status" SET DEFAULT '3'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "status" SET DEFAULT '1'
    `);
  }
}
