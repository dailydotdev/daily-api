import { MigrationInterface, QueryRunner } from 'typeorm';

const VIEW_EXPRESSION = /* sql */ `SELECT us."toolId" AS "toolId", COUNT(*) AS "stackCount", COUNT(*) FILTER (WHERE us."createdAt" >= now() - interval '90 days') AS "recentCount" FROM "public"."user_stack" "us" GROUP BY us."toolId"`;

export class ToolStackStats1786003000000 implements MigrationInterface {
  name = 'ToolStackStats1786003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_stack_tool_id" ON "user_stack" ("toolId")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE MATERIALIZED VIEW "tool_stack_stats" AS ${VIEW_EXPRESSION}`,
    );
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tool_stack_stats_toolId" ON "tool_stack_stats" ("toolId")`,
    );
    await queryRunner.query(
      /* sql */ `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      ['public', 'MATERIALIZED_VIEW', 'tool_stack_stats', VIEW_EXPRESSION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'tool_stack_stats', 'public'],
    );
    await queryRunner.query(
      /* sql */ `DROP MATERIALIZED VIEW IF EXISTS "tool_stack_stats"`,
    );
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_stack_tool_id"`,
    );
  }
}
