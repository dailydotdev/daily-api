import { MigrationInterface, QueryRunner } from "typeorm";

export class RollbackSourceMemberHasUnreadPostsIndex1754397036840 implements MigrationInterface {
  name = 'RollbackSourceMemberHasUnreadPostsIndex1754397036840'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Drop the index in its latest state (composite index)
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert rollback: Recreate the composite index as it was before this rollback
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON public.source_member ("sourceId", COALESCE((flags ->> 'hasUnreadPosts')::boolean, FALSE));`);
  }
}
