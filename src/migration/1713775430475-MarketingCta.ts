import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketingCta1713775430475 implements MigrationInterface {
  name = 'MarketingCta1713775430475'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketing_cta" ADD "status" text NOT NULL DEFAULT 'active'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketing_cta" DROP COLUMN "status"`);
  }
}
