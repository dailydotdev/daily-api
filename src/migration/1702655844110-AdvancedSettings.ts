import { MigrationInterface, QueryRunner } from "typeorm";

export class AdvancedSettings1702655844110 implements MigrationInterface {
    name = 'AdvancedSettings1702655844110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD "options" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP COLUMN "options"`);
    }

}
