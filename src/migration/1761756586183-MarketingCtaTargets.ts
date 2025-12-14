import { MigrationInterface, QueryRunner } from "typeorm";

export class MarketingCtaTargets1761756586183 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "marketing_cta"
        ADD "targets" jsonb NOT NULL DEFAULT '{"webapp":true,"extension":true,"ios":true}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      ALTER TABLE "marketing_cta"
        DROP COLUMN "targets"
    `);
  }
}
