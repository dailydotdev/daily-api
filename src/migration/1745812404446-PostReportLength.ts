import { MigrationInterface, QueryRunner } from "typeorm";

export class PostReportLength1745812404446 implements MigrationInterface {
    name = 'PostReportLength1745812404446'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_report" ALTER COLUMN "reason" TYPE character varying(30)`);
        await queryRunner.query(`ALTER TABLE "post_report" ALTER COLUMN "reason" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_report" ALTER COLUMN "reason" TYPE character varying(12)`);
        await queryRunner.query(`ALTER TABLE "post_report" ALTER COLUMN "reason" SET NOT NULL`);
    }
}
