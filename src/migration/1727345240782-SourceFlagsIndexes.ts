import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlagsIndexes1727345240782 implements MigrationInterface {
  name = 'SourceFlagsIndexes1727345240782';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_source_flags_total_members RENAME TO "IDX_source_flags_total_members_sort"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_public_threshold" ON source USING HASH (((flags->'publicThreshold')::boolean))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_total_members" ON source USING HASH (((flags->'totalMembers')::integer))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_total_posts" ON source USING HASH (((flags->'totalPosts')::integer))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_source_flags_total_posts"`);
    await queryRunner.query(`DROP INDEX "IDX_source_flags_total_members"`);
    await queryRunner.query(`DROP INDEX "IDX_source_flags_public_threshold"`);
    await queryRunner.query(
      `ALTER INDEX "IDX_source_flags_total_members_sort RENAME TO "IDX_source_flags_total_members"`,
    );
  }
}
