import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixFeedTagIndex1684512961790 implements MigrationInterface {
  name = 'FixFeedTagIndex1684512961790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_feedTag_blocked"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_feed_id_blocked" ON "feed_tag" ("feedId", "blocked") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_feed_id_blocked"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_feedTag_blocked" ON "feed_tag" ("blocked") `,
    );
  }
}
