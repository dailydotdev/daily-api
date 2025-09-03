import { MigrationInterface, QueryRunner } from "typeorm";

export class OpportunityContentDefault1756900898321 implements MigrationInterface {
  name = 'OpportunityContentDefault1756900898321'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ALTER COLUMN "content" SET DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "opportunity" ALTER COLUMN "content" SET DEFAULT '{}'
    `);
  }
}
