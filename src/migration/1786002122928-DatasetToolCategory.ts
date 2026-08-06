import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatasetToolCategory1786002122928 implements MigrationInterface {
  name = 'DatasetToolCategory1786002122928';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "category" text`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_dataset_tool_category" ON "dataset_tool" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_dataset_tool_category"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "category"`,
    );
  }
}
