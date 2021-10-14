import {MigrationInterface, QueryRunner} from "typeorm";

export class SettingsAlertSidebar1634187611640 implements MigrationInterface {
    name = 'SettingsAlertSidebar1634187611640'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ADD "alertSidebar" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" DROP COLUMN "alertSidebar"`);
    }

}
