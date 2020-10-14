import {MigrationInterface, QueryRunner} from "typeorm";

export class ReputationOne1602675015961 implements MigrationInterface {
    name = 'ReputationOne1602675015961'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "public"."user" SET "reputation" = "reputation" + 1`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" ALTER COLUMN "reputation" SET DEFAULT 1`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ALTER COLUMN "reputation" SET DEFAULT 0`, undefined);
        await queryRunner.query(`UPDATE "public"."user" SET "reputation" = "reputation" - 1`, undefined);
    }

}
