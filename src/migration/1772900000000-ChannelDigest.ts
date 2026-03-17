import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelDigest1772900000000 implements MigrationInterface {
  name = 'ChannelDigest1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE TABLE "channel_digest" (
        "key" text NOT NULL,
        "sourceId" text NOT NULL,
        "channel" text NOT NULL,
        "targetAudience" text NOT NULL,
        "frequency" text NOT NULL,
        "includeSentiment" boolean NOT NULL DEFAULT false,
        "minHighlightScore" real,
        "sentimentGroupIds" text array NOT NULL DEFAULT '{}',
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_digest_key"
          PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(/* sql */ `
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_channel_digest_sourceId"
        ON "channel_digest" ("sourceId")
    `);

    await queryRunner.query(/* sql */ `
      INSERT INTO "channel_digest" (
        "key",
        "sourceId",
        "channel",
        "targetAudience",
        "frequency",
        "includeSentiment",
        "minHighlightScore",
        "sentimentGroupIds"
      )
      VALUES (
        'agentic',
        'agents_digest',
        'vibes',
        'software engineers and engineering leaders who care about AI tooling, agentic engineering, models, and vibe coding. They range from vibe coders to seasoned engineers tracking how AI is reshaping their craft.',
        'daily',
        true,
        0.65,
        ARRAY[
          '385404b4-f0f4-4e81-a338-bdca851eca31',
          '970ab2c9-f845-4822-82f0-02169713b814'
        ]::text[]
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP TABLE "channel_digest"
    `);
  }
}
