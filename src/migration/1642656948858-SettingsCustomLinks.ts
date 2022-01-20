import {MigrationInterface, QueryRunner} from "typeorm";

export class SettingsCustomLinks1642656948858 implements MigrationInterface {
    name = 'SettingsCustomLinks1642656948858'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD "customLinks" text array`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "customLinks"`);
    }

}
