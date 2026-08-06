import { Index, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'tool_stack_stats',
  materialized: true,
  expression: /* sql */ `
    SELECT
      us."toolId" AS "toolId",
      COUNT(*) AS "stackCount",
      COUNT(*) FILTER (WHERE us."createdAt" >= now() - interval '90 days') AS "recentCount"
    FROM "public"."user_stack" "us"
    GROUP BY us."toolId"
  `,
})
@Index('UQ_tool_stack_stats_toolId', ['toolId'], { unique: true })
export class ToolStackStats {
  @ViewColumn()
  toolId: string;

  @ViewColumn()
  stackCount: number;

  @ViewColumn()
  recentCount: number;
}
