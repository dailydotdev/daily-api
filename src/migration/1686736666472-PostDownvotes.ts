import { MigrationInterface, QueryRunner } from "typeorm";

export class PostDownvotes1686736666472 implements MigrationInterface {
    name = 'PostDownvotes1686736666472'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post" ADD "downvotes" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "IDX_post_downvotes" ON "post" ("downvotes") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_downvotes"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "downvotes"`);
    }

}
