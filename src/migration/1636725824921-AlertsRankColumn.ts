import {MigrationInterface, QueryRunner} from "typeorm";

export class AlertsRankColumn1636725824921 implements MigrationInterface {
    name = 'AlertsRankColumn1636725824921'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."alerts" ADD "rankLastSeen" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."alerts" DROP COLUMN "rankLastSeen"`);
    }

}
