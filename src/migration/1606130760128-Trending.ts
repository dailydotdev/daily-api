import {MigrationInterface, QueryRunner} from "typeorm";

export class Trending1606130760128 implements MigrationInterface {
    name = 'Trending1606130760128'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "trending" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "lastTrending" TIMESTAMP`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_trending" ON "public"."post" ("trending") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_last_trending" ON "public"."post" ("lastTrending") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_last_trending"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_trending"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "lastTrending"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "trending"`, undefined);
    }

}
