import { MigrationInterface, QueryRunner } from "typeorm";

export class TagRecommendation1697624128431 implements MigrationInterface {
    name = 'TagRecommendation1697624128431'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const isNonProductionEnv = ['development', 'test'].includes(process.env.NODE_ENV)
        const createdAtThreshold = isNonProductionEnv ? `'1970-01-01'` : `(current_timestamp - interval '60 day')::date`;
        const totalThreshold = isNonProductionEnv ? 1 : 100;

        await queryRunner.query(`CREATE MATERIALIZED VIEW "tag_recommendation" AS
          with keywords as (
              select pk."postId", pk.keyword
              from post_keyword pk
              join post p on p.id = pk."postId"
              where p."createdAt" >= ${createdAtThreshold} and pk.status = 'allow'
          ), totals as (
              select keyword, count(*) total
              from keywords
              group by 1
          ), filtered as (
              select k.*
              from keywords k
              join totals t on t.keyword = k.keyword
              where t.total >= ${totalThreshold}
          ), pairs as (
              select k1.keyword "keywordX", k2.keyword "keywordY"
              from filtered k1
              join filtered k2 on k1."postId" = k2."postId" and k1.keyword != k2.keyword
          ), likelihood as (
              select "keywordX", "keywordY", count(*) * 1.0 / min(t.total) as probability
              from pairs p
              join totals t on p."keywordX" = t.keyword
              group by 1, 2
          )
          select * from likelihood
          where probability > 0.05
        `);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","MATERIALIZED_VIEW","tag_recommendation","with keywords as (\n        select pk.\"postId\", pk.keyword\n        from post_keyword pk\n        join post p on p.id = pk.\"postId\"\n        where p.\"createdAt\" >= (current_timestamp - interval '60 day')::date and pk.status = 'allow'\n    ), totals as (\n        select keyword, count(*) total\n        from keywords\n        group by 1\n    ), filtered as (\n        select k.*\n        from keywords k\n        join totals t on t.keyword = k.keyword\n        where t.total >= 100\n    ), pairs as (\n        select k1.keyword \"keywordX\", k2.keyword \"keywordY\"\n        from filtered k1\n        join filtered k2 on k1.\"postId\" = k2.\"postId\" and k1.keyword != k2.keyword\n    ), likelihood as (\n        select \"keywordX\", \"keywordY\", count(*) * 1.0 / min(t.total) as probability\n        from pairs p\n        join totals t on p.\"keywordX\" = t.keyword\n        group by 1, 2\n    )\n    select * from likelihood\n    where probability > 0.05"]);
        await queryRunner.query(`CREATE INDEX "IDX_926d6b859895b9cbee8ea0678e" ON "tag_recommendation" ("keywordX", "keywordY", "probability") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_926d6b859895b9cbee8ea0678e"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["MATERIALIZED_VIEW","tag_recommendation","public"]);
        await queryRunner.query(`DROP MATERIALIZED VIEW "tag_recommendation"`);
    }

}
