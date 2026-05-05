import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelHighlightDisplayName1776106185909
  implements MigrationInterface
{
  name = 'ChannelHighlightDisplayName1776106185909';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "channel_highlight_definition"
        ADD COLUMN "displayName" text NOT NULL DEFAULT ''
    `);

    await queryRunner.query(/* sql */ `
      UPDATE "channel_highlight_definition"
      SET "displayName" = INITCAP(
        REPLACE(
          REPLACE("channel", '-', ' '),
          '_',
          ' '
        )
      )
      WHERE "displayName" = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "channel_highlight_definition"
        DROP COLUMN "displayName"
    `);
  }
}
