import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveChannelDigestSentimentFields1776200000000
  implements MigrationInterface
{
  name = 'RemoveChannelDigestSentimentFields1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "channel_digest"
        DROP COLUMN "includeSentiment",
        DROP COLUMN "minHighlightScore",
        DROP COLUMN "sentimentGroupIds"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "channel_digest"
        ADD COLUMN "includeSentiment" boolean NOT NULL DEFAULT false,
        ADD COLUMN "minHighlightScore" real,
        ADD COLUMN "sentimentGroupIds" text array NOT NULL DEFAULT '{}'
    `);
  }
}
