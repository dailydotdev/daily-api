import { MigrationInterface, QueryRunner } from 'typeorm';

export class ToolVoteAndDiscussion1787130000000 implements MigrationInterface {
  name = 'ToolVoteAndDiscussion1787130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "tool_vote" (
        "userId" text NOT NULL,
        "toolId" uuid NOT NULL,
        "vote" smallint NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tool_vote" PRIMARY KEY ("userId", "toolId"),
        CONSTRAINT "CHK_tool_vote_vote" CHECK ("vote" IN (-1, 1)),
        CONSTRAINT "FK_tool_vote_user_id" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tool_vote_tool_id" FOREIGN KEY ("toolId") REFERENCES "dataset_tool"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_tool_vote_tool_id_vote" ON "tool_vote" ("toolId", "vote")`,
    );
    await queryRunner.query(
      /* sql */ `INSERT INTO "public"."source" ("id", "name", "handle", "private", "type", "active", "image") VALUES ('tools', 'Tools', 'tools', false, 'machine', true, 'https://media.daily.dev/image/upload/s--LrHsyt2T--/f_auto/v1692632054/squad_placeholder_sfwkmj') ON CONFLICT ("id") DO NOTHING`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD COLUMN IF NOT EXISTS "discussionPostId" text`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" ADD CONSTRAINT "FK_dataset_tool_discussion_post_id" FOREIGN KEY ("discussionPostId") REFERENCES "post"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP CONSTRAINT IF EXISTS "FK_dataset_tool_discussion_post_id"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "dataset_tool" DROP COLUMN IF EXISTS "discussionPostId"`,
    );
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "tool_vote"`);
  }
}
