import { MigrationInterface, QueryRunner } from "typeorm";

export class UCPDefault1757501690774 implements MigrationInterface {
  name = 'UCPDefault1757501690774'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "employmentType" SET NOT NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "employmentType" SET DEFAULT '{}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "locationType" SET DEFAULT '{}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companyStage" SET NOT NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companyStage" SET DEFAULT '{}'
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companySize" SET NOT NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companySize" SET DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companySize" DROP DEFAULT
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companySize" DROP NOT NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companyStage" DROP DEFAULT
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "companyStage" DROP NOT NULL
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "locationType" DROP DEFAULT
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "employmentType" DROP DEFAULT
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "employmentType" DROP NOT NULL
    `);
  }
}
