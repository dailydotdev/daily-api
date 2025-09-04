import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityStateInt1756845623169 implements MigrationInterface {
  name = 'OpportunityStateInt1756845623169'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "state"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "state" integer NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" DROP COLUMN "state"
    `);
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ADD "state" text NOT NULL
    `);
  }
}
