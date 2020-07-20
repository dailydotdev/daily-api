import {MigrationInterface, QueryRunner} from "typeorm";

export class UniqueShortId1595249902828 implements MigrationInterface {
    name = 'UniqueShortId1595249902828'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_permalink"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ALTER COLUMN "shortId" SET NOT NULL`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_post_shortid" ON "public"."post" ("shortId") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_shortid"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ALTER COLUMN "shortId" DROP NOT NULL`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_permalink" ON "public"."post" ("shortId") `, undefined);
    }

}
