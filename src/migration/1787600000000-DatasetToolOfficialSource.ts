import { MigrationInterface, QueryRunner } from 'typeorm';

export class DatasetToolOfficialSource1787600000000
  implements MigrationInterface
{
  name = 'DatasetToolOfficialSource1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "officialSourceId" text`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD CONSTRAINT "FK_dataset_tool_official_source_id" FOREIGN KEY ("officialSourceId") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_dataset_tool_official_source_id" ON "dataset_tool" ("officialSourceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_dataset_tool_official_source_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP CONSTRAINT IF EXISTS "FK_dataset_tool_official_source_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "officialSourceId"`,
    );
  }
}
