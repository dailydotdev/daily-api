import { MigrationInterface, QueryRunner } from "typeorm";

export class UserCandidatePreferenceCvParsedMarkdown1759768307910 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        ADD "cvParsedMarkdown" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference"
        DROP COLUMN "cvParsedMarkdown"
    `);
  }
}
