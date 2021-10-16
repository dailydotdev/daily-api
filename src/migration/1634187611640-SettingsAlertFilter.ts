import {MigrationInterface, QueryRunner} from "typeorm";

export class SettingsAlertFilter1634187611640 implements MigrationInterface {
    name = 'SettingsAlertFilter1634187611640'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ADD "alertFilter" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" DROP COLUMN "alertFilter"`);
    }

}
