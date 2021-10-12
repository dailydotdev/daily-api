import {MigrationInterface, QueryRunner} from "typeorm";

export class keywordCategoriesAsArrayColumn1634032809070 implements MigrationInterface {
    name = 'keywordCategoriesAsArrayColumn1634032809070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "categories" text array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "categories"`);
    }

}
