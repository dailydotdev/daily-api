import {MigrationInterface, QueryRunner} from "typeorm";

export class SourceRankBoost1603894888844 implements MigrationInterface {
    name = 'SourceRankBoost1603894888844'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "rankBoost" integer NOT NULL DEFAULT 0`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "rankBoost"`, undefined);
    }

}
