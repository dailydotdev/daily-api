import { MigrationInterface, QueryRunner } from 'typeorm';

export class SourceTagView1712930614437 implements MigrationInterface {
  name = 'SourceTagView1712930614437';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isNonProductionEnv = ['development', 'test'].includes(
      process.env.NODE_ENV,
    );
    const createdAtThreshold = isNonProductionEnv
      ? `'1970-01-01'`
      : `(current_timestamp - interval '90 day')::date`;
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "source_tag_view" AS SELECT "s"."id" as "sourceId", "pk"."keyword" AS tag, count("pk"."keyword") AS count FROM "public"."source" "s" INNER JOIN "public"."post" "p" ON "p"."sourceId" = "s"."id" AND "p"."createdAt" > ${createdAtThreshold} INNER JOIN "public"."post_keyword" "pk" ON "pk"."postId" = "p"."id" AND "pk"."status" = 'allow' WHERE ("s"."active" = true AND "s"."private" = false) GROUP BY "s"."id", tag ORDER BY count DESC`,
    );
    await queryRunner.query(
      `INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        'public',
        'MATERIALIZED_VIEW',
        'source_tag_view',
        `SELECT "s"."id" as "sourceId", "pk"."keyword" AS tag, count("pk"."keyword") AS count FROM "public"."source" "s" INNER JOIN "public"."post" "p" ON "p"."sourceId" = "s"."id" AND "p"."createdAt" > ${createdAtThreshold}  INNER JOIN "public"."post_keyword" "pk" ON "pk"."postId" = "p"."id" AND "pk"."status" = 'allow' WHERE ("s"."active" = true AND "s"."private" = false) GROUP BY "s"."id", tag ORDER BY count DESC`,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`,
      ['MATERIALIZED_VIEW', 'source_tag_view', 'public'],
    );
    await queryRunner.query(`DROP MATERIALIZED VIEW "source_tag_view"`);
  }
}
