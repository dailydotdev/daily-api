import {MigrationInterface, QueryRunner} from "typeorm";

export class SettingsEnabledSorting1642055432413 implements MigrationInterface {
    name = 'SettingsEnabledSorting1642055432413'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" ADD "sortingEnabled" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "sortingEnabled"`);
    }

}
