import { MigrationInterface, QueryRunner } from "typeorm";

export class ExperimentVariationType1748371994832 implements MigrationInterface {
  name = 'ExperimentVariationType1748371994832'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "experiment_variant" ADD "type" text`);
    await queryRunner.query(`UPDATE "experiment_variant" SET "type" = 'productPricing' WHERE "type" IS NULL`);
    await queryRunner.query(`ALTER TABLE "experiment_variant" ALTER COLUMN "type" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "experiment_variant" DROP COLUMN "type"`);
  }
}
