import { MigrationInterface, QueryRunner } from 'typeorm';

export class ToolVoteAndComment1786100000000 implements MigrationInterface {
  name = 'ToolVoteAndComment1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "tool_vote" (
        "userId" text NOT NULL,
        "toolId" uuid NOT NULL,
        "vote" smallint NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tool_vote" PRIMARY KEY ("userId", "toolId"),
        CONSTRAINT "FK_tool_vote_user_id" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tool_vote_tool_id" FOREIGN KEY ("toolId") REFERENCES "dataset_tool"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_tool_vote_tool_id_vote" ON "tool_vote" ("toolId", "vote")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "tool_comment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "toolId" uuid NOT NULL,
        "userId" text NOT NULL,
        "content" text NOT NULL,
        "contentHtml" text NOT NULL,
        "parentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tool_comment_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tool_comment_user_id" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tool_comment_tool_id" FOREIGN KEY ("toolId") REFERENCES "dataset_tool"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tool_comment_parent_id" FOREIGN KEY ("parentId") REFERENCES "tool_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_tool_comment_tool_id" ON "tool_comment" ("toolId")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_tool_comment_parent_id" ON "tool_comment" ("parentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "tool_comment"`);
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "tool_vote"`);
  }
}
