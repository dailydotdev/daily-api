import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlagFeaturedIndex1715592299433
  implements MigrationInterface
{
  name = 'SourceFlagFeaturedIndex1715592299433';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_featured" ON source USING HASH (((flags->'featured')::boolean))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_source_flags_featured"`);
  }
}
