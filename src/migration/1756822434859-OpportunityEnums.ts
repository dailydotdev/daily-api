import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityEnums1756822434859 implements MigrationInterface {
  name = 'OpportunityEnums1756822434859'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "status" SET DEFAULT '1'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "user_candidate_preference" ALTER COLUMN "status" SET DEFAULT 'disabled'
    `);
  }
}
