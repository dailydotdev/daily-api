import { MigrationInterface, QueryRunner } from "typeorm";

export class RollbackSourceMemberHasUnreadPostsIndexFix1754321021916 implements MigrationInterface {
  name = 'RollbackSourceMemberHasUnreadPostsIndexFix1754321021916'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Drop the index that was created
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert rollback: Recreate the index
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON "source_member" (("flags"->>'hasUnreadPosts'));`)
  }
}
