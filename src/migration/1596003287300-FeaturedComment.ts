import {MigrationInterface, QueryRunner} from "typeorm";

export class FeaturedComment1596003287300 implements MigrationInterface {
    name = 'FeaturedComment1596003287300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."comment" ADD "featured" boolean NOT NULL DEFAULT false`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_comment_featured" ON "public"."comment" ("featured") `, undefined);
        await queryRunner.query(`INSERT INTO "public"."checkpoint" ("key", "timestamp") VALUES ('last_featured_comments_update', $1)`, [new Date(0)]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_featured"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" DROP COLUMN "featured"`, undefined);
        await queryRunner.query(`DELETE FROM "public"."checkpoint" WHERE "key" = 'last_featured_comments_update'`, undefined);
    }

}
