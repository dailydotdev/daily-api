import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceFlagsIndexes1727345240782 implements MigrationInterface {
  name = 'SourceFlagsIndexes1727345240782';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_flags_posts_members_threshold" ON source(((flags->'totalPosts')::integer), ((flags->'totalMembers')::integer), ((flags->'publicThreshold')::boolean))`,
    );
    await queryRunner.query(
      `UPDATE "public"."source"
        SET flags = jsonb_set(flags, '{publicThreshold}',
          to_jsonb(
            "image" IS NOT NULL AND
            "description" IS NOT NULL AND
            coalesce((flags->>'totalMembers')::integer, 0) >= 3 AND
            coalesce((flags->>'totalPosts')::integer, 0) >= 3 AND
            (flags->>'publicThreshold')::boolean IS NOT TRUE
          )
        )
        WHERE type = 'squad'`,
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
