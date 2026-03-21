import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostHighlight1772800000000 implements MigrationInterface {
  name = 'PostHighlight1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "post_highlight" (
        "id"                 uuid            NOT NULL DEFAULT uuid_generate_v4(),
        "channel"            TEXT            NOT NULL,
        "postId"             TEXT            NOT NULL,
        "highlightedAt"      TIMESTAMP       NOT NULL,
        "headline"           TEXT            NOT NULL,
        "significanceLabel"  TEXT,
        "reason"             TEXT,
        "createdAt"          TIMESTAMP       NOT NULL DEFAULT now(),
        "updatedAt"          TIMESTAMP       NOT NULL DEFAULT now(),

        CONSTRAINT "PK_post_highlight"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_post_highlight_channel_post"
          UNIQUE ("channel", "postId"),

        CONSTRAINT "FK_post_highlight_post"
          FOREIGN KEY ("postId")
          REFERENCES "post" ("id")
          ON DELETE CASCADE
      );

      CREATE INDEX "IDX_post_highlight_post"
        ON "post_highlight" ("postId");

      CREATE INDEX "IDX_post_highlight_channel_highlightedAt"
        ON "post_highlight" ("channel", "highlightedAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "post_highlight";
    `);
  }
}
