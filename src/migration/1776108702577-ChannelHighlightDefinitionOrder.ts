import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelHighlightDefinitionOrder1776108702577
  implements MigrationInterface
{
  name = 'ChannelHighlightDefinitionOrder1776108702577';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "channel_highlight_definition"
        ADD COLUMN "order" smallint NOT NULL DEFAULT 0
    `);

    await queryRunner.query(/* sql */ `
      WITH ordered_definitions AS (
        SELECT
          "channel",
          ROW_NUMBER() OVER (ORDER BY "channel" ASC) - 1 AS "order"
        FROM "channel_highlight_definition"
      )
      UPDATE "channel_highlight_definition" AS definition
      SET "order" = ordered_definitions."order"
      FROM ordered_definitions
      WHERE ordered_definitions."channel" = definition."channel"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      ALTER TABLE "channel_highlight_definition"
        DROP COLUMN "order"
    `);
  }
}
