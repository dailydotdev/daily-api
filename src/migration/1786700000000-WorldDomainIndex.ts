import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * View bodies are spelled out rather than imported, as with the niche index:
 * a migration has to keep meaning what it meant the day it ran. The constants
 * it interpolates (WORLD_RANK_DEPTH, WORLD_RANK_WEEK_DAYS,
 * SERVING_HIDDEN_NICHE_SLUGS) are expanded below, and changing any of them
 * means a new migration that recreates the views.
 */

const DOMAIN_NICHE = /* sql */ `SELECT id, domain FROM niche WHERE domain IS NOT NULL AND slug NOT IN ('blockchain')`;

const RANK_VIEW = /* sql */ `SELECT "domain", 'all' AS "period", "userId", "reads" FROM (SELECT n.domain AS "domain", d."userId", sum(d."reads")::int AS "reads", row_number() OVER (PARTITION BY n.domain ORDER BY sum(d."reads") DESC, d."userId") AS "position" FROM user_niche_analytics d INNER JOIN user_world_summary w ON w."userId" = d."userId" INNER JOIN (${DOMAIN_NICHE}) n ON n.id = d."nicheId" GROUP BY n.domain, d."userId") ranked WHERE "position" <= 1000 AND "reads" > 0 UNION ALL SELECT "domain", 'week' AS "period", "userId", "reads" FROM (SELECT n.domain AS "domain", g."userId", sum(g."reads")::int AS "reads", row_number() OVER (PARTITION BY n.domain ORDER BY sum(g."reads") DESC, g."userId") AS "position" FROM user_niche_growth g INNER JOIN user_world_summary w ON w."userId" = g."userId" INNER JOIN (${DOMAIN_NICHE}) n ON n.id = g."nicheId" WHERE g."date" >= (now() - interval '7 days')::date GROUP BY n.domain, g."userId") ranked WHERE "position" <= 1000`;

const STATS_VIEW = /* sql */ `SELECT n.domain AS "domain", count(DISTINCT d."userId")::int AS "readers" FROM user_niche_analytics d INNER JOIN user_world_summary w ON w."userId" = d."userId" INNER JOIN niche n ON n.id = d."nicheId" WHERE n.domain IS NOT NULL AND n.slug NOT IN ('blockchain') GROUP BY n.domain`;

const VIEWS: [string, string][] = [
  ['user_domain_rank', RANK_VIEW],
  ['domain_world_stats', STATS_VIEW],
];

export class WorldDomainIndex1786700000000 implements MigrationInterface {
  name = 'WorldDomainIndex1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE "niche" ADD COLUMN IF NOT EXISTS "domain" text`,
    );

    /*
     * The mapping the renderer's taxonomy already draws, written down where the
     * database can group by it. A niche added later arrives with a null domain
     * and is simply absent from the domain boards until somebody places it,
     * which is the safe direction: its own niche board is unaffected.
     */
    await queryRunner.query(
      /* sql */ `UPDATE niche SET domain = 'ai' WHERE slug IN ('ai_llm', 'ai_agents', 'ai_infra', 'ml_ds', 'data_eng', 'ai_safety', 'python')`,
    );
    await queryRunner.query(
      /* sql */ `UPDATE niche SET domain = 'web' WHERE slug IN ('js_ts', 'css_design', 'android', 'ios_apple', 'jvm', 'dotnet', 'php', 'ruby')`,
    );
    await queryRunner.query(
      /* sql */ `UPDATE niche SET domain = 'systems' WHERE slug IN ('c_cpp', 'rust', 'linux_os', 'embedded', 'gamedev', 'niche_langs')`,
    );
    await queryRunner.query(
      /* sql */ `UPDATE niche SET domain = 'cloud' WHERE slug IN ('k8s', 'cloud', 'go', 'ci_devex', 'observability', 'databases', 'distributed_arch', 'selfhost')`,
    );
    await queryRunner.query(
      /* sql */ `UPDATE niche SET domain = 'security' WHERE slug IN ('sec_appsec', 'sec_crypto', 'sec_threats')`,
    );
    await queryRunner.query(
      /* sql */ `UPDATE niche SET domain = 'craft' WHERE slug IN ('devtools', 'git_vcs', 'software_craft', 'cs_fundamentals', 'career', 'eng_mgmt', 'industry_news', 'other')`,
    );

    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_niche_domain" ON "niche" ("domain")`,
    );

    for (const [name, expression] of VIEWS) {
      await queryRunner.query(
        /* sql */ `CREATE MATERIALIZED VIEW "${name}" AS ${expression}`,
      );
      await queryRunner.query(
        /* sql */ `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
        ['public', 'MATERIALIZED_VIEW', name, expression],
      );
    }

    // Unique indexes are what REFRESH ... CONCURRENTLY requires.
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_domain_rank_key" ON "user_domain_rank" ("domain", "period", "userId")`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_domain_rank_listing" ON "user_domain_rank" ("domain", "period", "reads" DESC, "userId" ASC)`,
    );
    await queryRunner.query(
      /* sql */ `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_domain_world_stats_domain" ON "domain_world_stats" ("domain")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of [...VIEWS].reverse()) {
      await queryRunner.query(
        /* sql */ `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
        ['MATERIALIZED_VIEW', name, 'public'],
      );
      await queryRunner.query(
        /* sql */ `DROP MATERIALIZED VIEW IF EXISTS "${name}"`,
      );
    }

    await queryRunner.query(/* sql */ `DROP INDEX IF EXISTS "IDX_niche_domain"`);
    await queryRunner.query(
      /* sql */ `ALTER TABLE "niche" DROP COLUMN IF EXISTS "domain"`,
    );
  }
}
