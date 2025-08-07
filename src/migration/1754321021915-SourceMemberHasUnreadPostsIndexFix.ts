import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceMemberHasUnreadPostsIndexFix1754321021915 implements MigrationInterface {
  name = 'SourceMemberHasUnreadPostsIndexFix1754321021915'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON "source_member" (("flags"->>'hasUnreadPosts'));`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`)
  }
}
