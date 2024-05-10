import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomFeed1715346601781 implements MigrationInterface {
    name = 'CustomFeed1715346601781'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feed" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "feed" ADD "flags" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "feed" ADD "slug" text GENERATED ALWAYS AS (trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(feed.flags->>'name',100),'')||'-'||feed.id)), '[^a-z0-9-]+', '-', 'gi'))) STORED NOT NULL`);
        await queryRunner.query(`ALTER TABLE "feed" ADD CONSTRAINT "UQ_525e9690007e854091d2b662848" UNIQUE ("slug")`);
        await queryRunner.query(`INSERT INTO "public"."typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["api","public","feed","GENERATED_COLUMN","slug","trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT(feed.flags->>'name',100),'')||'-'||feed.id)), '[^a-z0-9-]+', '-', 'gi'))"]);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feed_slug" ON "feed" ("slug") `);
        await queryRunner.query(`ALTER TABLE "feed" ADD CONSTRAINT "FK_70952a3f1b3717e7021a439edda" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feed" DROP CONSTRAINT "FK_70952a3f1b3717e7021a439edda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feed_slug"`);
        await queryRunner.query(`DELETE FROM "public"."typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","slug","api","public","feed"]);
        await queryRunner.query(`ALTER TABLE "feed" DROP CONSTRAINT "UQ_525e9690007e854091d2b662848"`);
        await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "slug"`);
        await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "flags"`);
        await queryRunner.query(`ALTER TABLE "feed" DROP COLUMN "createdAt"`);
    }

}
