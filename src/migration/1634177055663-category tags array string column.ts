import {MigrationInterface, QueryRunner} from "typeorm";

export class categoryTagsArrayStringColumn1634177055663 implements MigrationInterface {
    name = 'categoryTagsArrayStringColumn1634177055663'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."category" ADD "tags" text array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."category" DROP COLUMN "tags"`);
    }

}
