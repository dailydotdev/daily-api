import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorldIndex1786600000000 implements MigrationInterface {
  name = 'WorldIndex1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The eligibility set, and the numbers every card on the index needs. One
    // row per world that may be listed; absence is what makes a world unlistable.
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "user_world_summary" ("userId" text NOT NULL, "districts" integer NOT NULL, "reads" integer NOT NULL, "topNiches" jsonb NOT NULL DEFAULT '[]'::jsonb, CONSTRAINT "PK_user_world_summary" PRIMARY KEY ("userId"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_world_summary_reads" ON "user_world_summary" ("reads")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_world_summary" ADD CONSTRAINT "FK_user_world_summary_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Both ranking periods in one table. The key leads with "nicheId" because
    // every read is one topic at a time, the reverse of user_niche_analytics,
    // which leads with "userId" because it is read one world at a time.
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "user_niche_rank" ("nicheId" uuid NOT NULL, "period" text NOT NULL, "userId" text NOT NULL, "reads" integer NOT NULL, "lifetimeReads" integer NOT NULL, CONSTRAINT "PK_user_niche_rank" PRIMARY KEY ("nicheId", "period", "userId"))`,
    );
    // Serves the listing (range scan, no sort) and the viewer's own placing
    // (count of the rows above them, bounded by the depth cap).
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_niche_rank_listing" ON "user_niche_rank" ("nicheId", "period", "reads" DESC)`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_niche_rank" ADD CONSTRAINT "FK_user_niche_rank_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_niche_rank" ADD CONSTRAINT "FK_user_niche_rank_nicheId" FOREIGN KEY ("nicheId") REFERENCES "niche"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Readers per topic, counted over the whole population rather than the
    // capped top of it.
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "niche_world_stats" ("nicheId" uuid NOT NULL, "readers" integer NOT NULL, CONSTRAINT "PK_niche_world_stats" PRIMARY KEY ("nicheId"))`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "niche_world_stats" ADD CONSTRAINT "FK_niche_world_stats_nicheId" FOREIGN KEY ("nicheId") REFERENCES "niche"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Rung crossings, written by the delta cron that already computes them.
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

    // The growth log's primary key leads with "userId", so a seven-day window
    // across every reader, which is what the weekly ranking is, has no index
    // to stand on and reads the whole table. This is the one index that makes
    // that rebuild proportional to the window instead of to all of history.
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_niche_growth_date" ON "user_niche_growth" ("date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_niche_growth_date"`,
    );

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

    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "niche_world_stats" DROP CONSTRAINT IF EXISTS "FK_niche_world_stats_nicheId"`,
    );
    await queryRunner.query(
      /* sql */ `DROP TABLE IF EXISTS "niche_world_stats"`,
    );

    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_niche_rank" DROP CONSTRAINT IF EXISTS "FK_user_niche_rank_nicheId"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_niche_rank" DROP CONSTRAINT IF EXISTS "FK_user_niche_rank_userId"`,
    );
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_niche_rank_listing"`,
    );
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "user_niche_rank"`);

    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_world_summary" DROP CONSTRAINT IF EXISTS "FK_user_world_summary_userId"`,
    );
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_world_summary_reads"`,
    );
    await queryRunner.query(
      /* sql */ `DROP TABLE IF EXISTS "user_world_summary"`,
    );
  }
}
