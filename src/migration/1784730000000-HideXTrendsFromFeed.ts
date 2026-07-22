import { MigrationInterface, QueryRunner } from 'typeorm';

export class HideXTrendsFromFeed1784730000000 implements MigrationInterface {
  name = 'HideXTrendsFromFeed1784730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // x-trends is an aggregation-only source: it stays public but none of its
    // posts should surface in feeds. Backfill any that leaked in with
    // showOnFeed = true.
    await queryRunner.query(
      `UPDATE post SET flags = flags || '{"showOnFeed": false}', "showOnFeed" = false WHERE "sourceId" = 'x-trends' AND "showOnFeed" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: we intentionally do not restore feed visibility for x-trends
    // posts, since they must never be shown on feed.
  }
}
