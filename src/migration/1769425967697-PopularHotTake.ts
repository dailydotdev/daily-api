import { MigrationInterface, QueryRunner } from "typeorm";

export class PopularHotTake1769425967697 implements MigrationInterface {
  name = "PopularHotTake1769425967697";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE MATERIALIZED VIEW IF NOT EXISTS "popular_hot_take" AS
      SELECT
        id AS "hotTakeId",
        upvotes AS "score"
      FROM "public"."hot_take" "base"
      WHERE upvotes > 0
      ORDER BY upvotes DESC, "createdAt" DESC
    `);

    await queryRunner.query(
      /* sql */ `
      INSERT INTO "public"."typeorm_metadata" (
        "database",
        "schema",
        "table",
        "type",
        "name",
        "value"
      )
      VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
    `,
      [
        "public",
        "MATERIALIZED_VIEW",
        "popular_hot_take",
        'SELECT id AS "hotTakeId", upvotes AS "score" FROM "public"."hot_take" "base" WHERE upvotes > 0 ORDER BY upvotes DESC, "createdAt" DESC',
      ]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      /* sql */ `
      DELETE FROM "public"."typeorm_metadata"
      WHERE "type" = $1
        AND "name" = $2
        AND "schema" = $3
    `,
      ["MATERIALIZED_VIEW", "popular_hot_take", "public"]
    );

    await queryRunner.query(/* sql */ `
      DROP MATERIALIZED VIEW IF EXISTS "popular_hot_take"
    `);
  }
}
