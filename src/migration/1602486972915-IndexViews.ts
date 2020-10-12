import {MigrationInterface, QueryRunner} from "typeorm";

export class IndexViews1602486972915 implements MigrationInterface {
    name = 'IndexViews1602486972915'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_post_views" ON "public"."post" ("views") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_views"`, undefined);
    }

}
