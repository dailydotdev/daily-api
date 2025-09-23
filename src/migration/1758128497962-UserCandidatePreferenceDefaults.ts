import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreferenceDefaults1758128497962 implements MigrationInterface {
  name = 'UserCandidatePreferenceDefaults1758128497962'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "companyStage" SET DEFAULT '{1,2,3,4,5,6,7,8,9,10}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "companySize" SET DEFAULT '{1,2,3,4,5,6,7}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "companySize" SET DEFAULT '{}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ALTER COLUMN "companyStage" SET DEFAULT '{}'
    `);
  }
}
