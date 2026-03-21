import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostHighlight1772800000000 implements MigrationInterface {
  name = 'PostHighlight1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "post_highlight" (
        "channel"   TEXT            NOT NULL,
        "postId"    TEXT            NOT NULL,
        "rank"      SMALLINT        NOT NULL,
        "headline"  TEXT            NOT NULL,
        "createdAt" TIMESTAMP       NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP       NOT NULL DEFAULT now(),

        CONSTRAINT "PK_post_highlight"
          PRIMARY KEY ("channel", "postId"),

        CONSTRAINT "FK_post_highlight_post"
          FOREIGN KEY ("postId")
          REFERENCES "post" ("id")
          ON DELETE CASCADE
      );

      CREATE INDEX "IDX_post_highlight_post"
        ON "post_highlight" ("postId");

      CREATE INDEX "IDX_post_highlight_channel_rank"
        ON "post_highlight" ("channel", "rank");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "post_highlight";
    `);
  }
}
