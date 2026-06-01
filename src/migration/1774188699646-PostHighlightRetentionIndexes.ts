import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostHighlightRetentionIndexes1774188699646
  implements MigrationInterface
{
  name = 'PostHighlightRetentionIndexes1774188699646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_post_highlight_channel_highlightedAt"
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_highlight_active_channel_highlightedAt"
        ON "post_highlight" ("channel", "highlightedAt" DESC)
        WHERE "retiredAt" IS NULL
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_highlight_retiredAt"
        ON "post_highlight" ("retiredAt")
        WHERE "retiredAt" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_post_highlight_retiredAt"
    `);

    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "IDX_post_highlight_active_channel_highlightedAt"
    `);

    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_post_highlight_channel_highlightedAt"
        ON "post_highlight" ("channel", "highlightedAt")
    `);
  }
}
