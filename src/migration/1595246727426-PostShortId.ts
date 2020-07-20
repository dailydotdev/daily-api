import {MigrationInterface, QueryRunner} from "typeorm";

export class PostShortId1595246727426 implements MigrationInterface {
    name = 'PostShortId1595246727426'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "shortId" character varying(14)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_permalink" ON "public"."post" ("shortId") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_permalink"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "shortId"`, undefined);
    }

}
