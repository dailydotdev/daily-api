import { MigrationInterface, QueryRunner } from "typeorm";

export class RollbackSourceMemberHasUnreadPostsIndex1754397036840 implements MigrationInterface {
  name = 'RollbackSourceMemberHasUnreadPostsIndex1754397036840'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Drop the composite index and recreate the simple index
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`);
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON "source_member" (("flags"->>'hasUnreadPosts'));`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert rollback: Drop simple index and recreate composite index
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`);
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON public.source_member ("sourceId", COALESCE((flags ->> 'hasUnreadPosts')::boolean, FALSE));`);
  }
}
