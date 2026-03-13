import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryToDatasetGear1772100000000
  implements MigrationInterface
{
  name = 'AddCategoryToDatasetGear1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dataset_gear"
        ADD COLUMN "category" text`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_dataset_gear_category"
        ON "dataset_gear" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dataset_gear_category"`);

    await queryRunner.query(
      `ALTER TABLE "dataset_gear"
        DROP COLUMN "category"`,
    );
  }
}
