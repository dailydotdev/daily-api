import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserWorld1785700000000 implements MigrationInterface {
  name = 'UserWorld1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Districts. PK is ("userId", "nicheId") in that order on purpose — rendering a
    // world reads 4-40 rows for one user, so a userId-leading key makes it one range
    // scan instead of up to 40 point lookups.
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "user_niche_analytics" ("userId" text NOT NULL, "nicheId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "reads" integer NOT NULL DEFAULT 0, "firstReadAt" date NOT NULL, "lastReadAt" date NOT NULL, "activeDays" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_user_niche_analytics" PRIMARY KEY ("userId", "nicheId"))`,
    );
    await queryRunner.query(
      /* sql */ `CREATE INDEX IF NOT EXISTS "IDX_user_niche_analytics_updatedAt" ON "user_niche_analytics" ("updatedAt")`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_niche_analytics" ADD CONSTRAINT "FK_user_niche_analytics_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_niche_analytics" ADD CONSTRAINT "FK_user_niche_analytics_nicheId" FOREIGN KEY ("nicheId") REFERENCES "niche"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Growth log — the timeline, and the delta ledger the cron writes to first.
    await queryRunner.query(
      /* sql */ `CREATE TABLE IF NOT EXISTS "user_niche_growth" ("userId" text NOT NULL, "date" date NOT NULL, "nicheId" uuid NOT NULL, "reads" integer NOT NULL, CONSTRAINT "PK_user_niche_growth" PRIMARY KEY ("userId", "date", "nicheId"))`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_niche_growth" ADD CONSTRAINT "FK_user_niche_growth_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE "user_niche_growth" ADD CONSTRAINT "FK_user_niche_growth_nicheId" FOREIGN KEY ("nicheId") REFERENCES "niche"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_niche_growth" DROP CONSTRAINT IF EXISTS "FK_user_niche_growth_nicheId"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_niche_growth" DROP CONSTRAINT IF EXISTS "FK_user_niche_growth_userId"`,
    );
    await queryRunner.query(/* sql */ `DROP TABLE IF EXISTS "user_niche_growth"`);

    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_niche_analytics" DROP CONSTRAINT IF EXISTS "FK_user_niche_analytics_nicheId"`,
    );
    await queryRunner.query(
      /* sql */ `ALTER TABLE IF EXISTS "user_niche_analytics" DROP CONSTRAINT IF EXISTS "FK_user_niche_analytics_userId"`,
    );
    await queryRunner.query(
      /* sql */ `DROP INDEX IF EXISTS "IDX_user_niche_analytics_updatedAt"`,
    );
    await queryRunner.query(
      /* sql */ `DROP TABLE IF EXISTS "user_niche_analytics"`,
    );
  }
}
