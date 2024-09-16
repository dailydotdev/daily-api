import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceCategoryTitleLower1726502797342
  implements MigrationInterface
{
  name = 'SourceCategoryTitleLower1726502797342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_source_category_lower_title" ON "source_category" ((lower(title)));`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_source_category_lower_title";`,
    );
  }
}
