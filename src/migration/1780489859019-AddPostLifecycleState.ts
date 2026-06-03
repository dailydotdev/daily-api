import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostLifecycleState1780489859019 implements MigrationInterface {
  name = 'AddPostLifecycleState1780489859019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "post_lifecycle_state" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" text NOT NULL,
        "state" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_lifecycle_state" PRIMARY KEY ("id"),
        CONSTRAINT "FK_post_lifecycle_state_post"
          FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_post_lifecycle_state_post"
        ON "post_lifecycle_state" ("postId")
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW "post_hero" AS
      SELECT DISTINCT ON ("postId")
        id,
        "postId",
        headline,
        significance,
        "highlightedAt"
      FROM (
        SELECT
          id, "postId", headline,
          CASE significance
            WHEN 1 THEN 'breaking'
            WHEN 2 THEN 'major'
            WHEN 3 THEN 'notable'
            WHEN 4 THEN 'routine'
          END AS significance,
          "highlightedAt", 0 AS src
        FROM highlights_canonical
        WHERE significance != 0
          AND "highlightedAt" > now() - interval '12 hours'

        UNION ALL

        SELECT
          id, "postId",
          CASE state
            WHEN 'breakout'  THEN 'Breaking out'
            WHEN 'evergreen' THEN 'Evergreen'
          END AS headline,
          state AS significance,
          "updatedAt" AS "highlightedAt",
          1 AS src
        FROM post_lifecycle_state
        WHERE "updatedAt" > now() - interval '12 hours'
      ) u
      ORDER BY "postId", src
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_post_hero_post"
        ON "post_hero" ("postId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_post_hero_highlightedAt"
        ON "post_hero" ("highlightedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "post_hero"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_post_lifecycle_state_post"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "post_lifecycle_state"`);
  }
}
