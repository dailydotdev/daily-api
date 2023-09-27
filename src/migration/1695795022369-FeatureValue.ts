import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeatureValue1695795022369 implements MigrationInterface {
  name = 'FeatureValue1695795022369';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feature" ADD "value" smallint NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "feature" DROP COLUMN "value"`);
  }
}
