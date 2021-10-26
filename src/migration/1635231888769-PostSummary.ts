import {MigrationInterface, QueryRunner} from "typeorm";

export class PostSummary1635231888769 implements MigrationInterface {
    name = 'PostSummary1635231888769'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "summary" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "summary"`);
    }

}
