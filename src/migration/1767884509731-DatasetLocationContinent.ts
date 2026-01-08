import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatasetLocationContinent1767884509731 implements MigrationInterface {
  name = 'DatasetLocationContinent1767884509731';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dataset_location" ADD "continent" character varying`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ALTER COLUMN "country" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ALTER COLUMN "iso2" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ALTER COLUMN "iso3" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ADD CONSTRAINT "CHK_dataset_location_country_or_continent" CHECK ("country" IS NOT NULL OR "continent" IS NOT NULL)`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_country_subdivision_city_unique"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_location_country_subdivision_city_continent_unique" ON "dataset_location" ("country", "subdivision", "city", "continent")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dataset_location_continent_trgm" ON "dataset_location" USING gin ("continent" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dataset_location_continent_trgm"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_country_subdivision_city_continent_unique"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_location_country_subdivision_city_unique" ON "dataset_location" ("country", "subdivision", "city")`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" DROP CONSTRAINT "CHK_dataset_location_country_or_continent"`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ALTER COLUMN "iso3" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ALTER COLUMN "iso2" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" ALTER COLUMN "country" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "dataset_location" DROP COLUMN "continent"`,
    );
  }
}
