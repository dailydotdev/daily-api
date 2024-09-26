import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlagsIndexes1727345240782 implements MigrationInterface {
  name = 'SourceFlagsIndexes1727345240782';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_posts_members_threshold" ON source(((flags->'totalPosts')::integer), ((flags->'totalMembers')::integer), ((flags->'publicThreshold')::boolean))`,
    );
    await queryRunner.query(
      `UPDATE "public"."source" SET flags = flags || '{"publicThreshold": false}' WHERE type = 'squad'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "public"."source" SET flags = flags || '{"publicThreshold": null}'`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_source_flags_posts_members_threshold"`,
    );
  }
}
