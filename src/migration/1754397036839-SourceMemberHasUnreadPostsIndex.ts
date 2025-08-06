import { MigrationInterface, QueryRunner } from "typeorm";

export class SourceMemberHasUnreadPostsIndex1754397036839 implements MigrationInterface {
  name = 'SourceMemberHasUnreadPostsIndex1754397036839'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`);
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON public.source_member ("sourceId", COALESCE((flags ->> 'hasUnreadPosts')::boolean, FALSE));`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_source_member_flags_hasUnreadPosts";`);
    await queryRunner.query(/* sql */`CREATE INDEX IF NOT EXISTS "IDX_source_member_flags_hasUnreadPosts" ON "source_member" (("flags"->>'hasUnreadPosts'));`);
  }
}
