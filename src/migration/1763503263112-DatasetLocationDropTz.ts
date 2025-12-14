import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatasetLocationDropTz1763503263112 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dataset_location" DROP COLUMN IF EXISTS "timezone"`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" DROP COLUMN IF EXISTS "ranking"`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dataset_location_externalId" ON "dataset_location" ("externalId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dataset_location_externalId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ADD COLUMN IF NOT EXISTS "ranking" integer DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ADD COLUMN IF NOT EXISTS "timezone" text`,
    );
  }
}
