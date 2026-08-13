import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * The view bodies are spelled out here rather than imported from the entities.
 * A migration has to keep meaning what it meant the day it ran, and the
 * entities are free to move; the constants they interpolate
 * (WORLD_INDEX_MIN_DISTRICTS, WORLD_INDEX_TOP_NICHES, WORLD_RANK_DEPTH,
 * WORLD_RANK_WEEK_DAYS, SERVING_HIDDEN_NICHE_SLUGS) are expanded below.
 * Changing any of them means a new migration that recreates the views.
 */

const SUMMARY_VIEW = /* sql */ `SELECT "userId", min("districts")::int AS "districts", min("total")::int AS "reads", coalesce(jsonb_agg(jsonb_build_object('nicheId', "nicheId", 'reads', "reads") ORDER BY "position") FILTER (WHERE "position" <= 3), '[]'::jsonb) AS "topNiches" FROM (SELECT d."userId", d."nicheId", d."reads", row_number() OVER (PARTITION BY d."userId" ORDER BY d."reads" DESC, d."nicheId") AS "position", count(*) OVER (PARTITION BY d."userId") AS "districts", sum(d."reads") OVER (PARTITION BY d."userId") AS "total" FROM user_niche_analytics d WHERE d."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN ('blockchain')) AND NOT EXISTS (SELECT 1 FROM user_world_settings s WHERE s."userId" = d."userId" AND s.private = true)) world WHERE "districts" >= 3 GROUP BY "userId"`;

const RANK_VIEW = /* sql */ `SELECT "nicheId", 'all' AS "period", "userId", "reads", "reads" AS "lifetimeReads" FROM (SELECT d."nicheId", d."userId", d."reads", row_number() OVER (PARTITION BY d."nicheId" ORDER BY d."reads" DESC, d."userId") AS "position" FROM user_niche_analytics d INNER JOIN user_world_summary w ON w."userId" = d."userId" WHERE d."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN ('blockchain'))) ranked WHERE "position" <= 1000 AND "reads" > 0 UNION ALL SELECT "nicheId", 'week' AS "period", "userId", "reads", "lifetimeReads" FROM (SELECT g."nicheId", g."userId", sum(g."reads")::int AS "reads", max(d."reads") AS "lifetimeReads", row_number() OVER (PARTITION BY g."nicheId" ORDER BY sum(g."reads") DESC, g."userId") AS "position" FROM user_niche_growth g INNER JOIN user_world_summary w ON w."userId" = g."userId" INNER JOIN user_niche_analytics d ON d."userId" = g."userId" AND d."nicheId" = g."nicheId" WHERE g."date" >= (now() - interval '7 days')::date AND g."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN ('blockchain')) GROUP BY g."nicheId", g."userId") ranked WHERE "position" <= 1000`;

const STATS_VIEW = /* sql */ `SELECT d."nicheId", count(*)::int AS "readers" FROM user_niche_analytics d INNER JOIN user_world_summary w ON w."userId" = d."userId" WHERE d."nicheId" NOT IN (SELECT id FROM niche WHERE slug IN ('blockchain')) GROUP BY d."nicheId"`;

const VIEWS: [string, string][] = [
  ['user_world_summary', SUMMARY_VIEW],
  ['user_niche_rank', RANK_VIEW],
  ['niche_world_stats', STATS_VIEW],
];

export class WorldIndex1786600000000 implements MigrationInterface {
  name = 'WorldIndex1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The week's ranking bounds `date` first; without this it scans every day
    // the platform has recorded to answer a question about seven of them.
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_niche_growth_date" ON "user_niche_growth" ("date")`,
    );

    // Ordered: the ranking and the topic counts both join the summary.
    for (const [name, expression] of VIEWS) {
      await queryRunner.query(
        /* sql */ `CREATE MATERIALIZED VIEW "${name}" AS ${expression}`,
      );
      await queryRunner.query(
        /* sql */ `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        ['public', 'MATERIALIZED_VIEW', name, expression],
      );
    }

    // Unique indexes are what REFRESH ... CONCURRENTLY requires, so the index
    // keeps serving while the views rebuild.
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_world_summary_userId" ON "user_world_summary" ("userId")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_world_summary_reads" ON "user_world_summary" ("reads")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_niche_rank_key" ON "user_niche_rank" ("nicheId", "period", "userId")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_niche_rank_listing" ON "user_niche_rank" ("nicheId", "period", "reads" DESC, "userId" ASC)`,
    );
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_niche_world_stats_nicheId" ON "niche_world_stats" ("nicheId")`,
    );

    // An event log, not a derivation: the delta cron records each crossing as
    // it applies it, so there is nothing to recompute it from later.
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "user_world_level_up" ("userId" text NOT NULL, "nicheId" uuid NOT NULL, "level" integer NOT NULL, "reads" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_user_world_level_up" PRIMARY KEY ("userId", "nicheId", "level"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_world_level_up_createdAt" ON "user_world_level_up" ("createdAt")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_world_level_up" ADD CONSTRAINT "FK_user_world_level_up_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_world_level_up" ADD CONSTRAINT "FK_user_world_level_up_nicheId" FOREIGN KEY ("nicheId") REFERENCES "niche"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_world_level_up" DROP CONSTRAINT IF EXISTS "FK_user_world_level_up_nicheId"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_world_level_up" DROP CONSTRAINT IF EXISTS "FK_user_world_level_up_userId"`,
    );
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_world_level_up_createdAt"`,
    );
    await queryRunner.query(
      /* sql */ `DROP TABLE IF EXISTS "user_world_level_up"`,
    );

    for (const [name] of [...VIEWS].reverse()) {
      await queryRunner.query(
        /* sql */ `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
        ['MATERIALIZED_VIEW', name, 'public'],
      );
      await queryRunner.query(
        /* sql */ `DROP MATERIALIZED VIEW IF EXISTS "${name}"`,
      );
    }

    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_niche_growth_date"`,
    );
  }
}
