import {MigrationInterface, QueryRunner} from "typeorm";

export class DevCardEligible1627479592436 implements MigrationInterface {
    name = 'DevCardEligible1627479592436'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "devcardEligible" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "devcardEligible"`);
    }

}
