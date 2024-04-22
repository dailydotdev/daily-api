import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketingCta1713745781667 implements MigrationInterface {
  name = 'MarketingCta1713745781667'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketing_cta" ADD "disabled" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "marketing_cta" DROP COLUMN "disabled"`);
  }
}
