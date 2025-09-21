import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreferenceEmpAgreement1758208725988 implements MigrationInterface {
  name = 'UserCandidatePreferenceEmpAgreement1758208725988'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ADD "employmentAgreement" jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        DROP COLUMN "employmentAgreement"
    `);
  }
}
