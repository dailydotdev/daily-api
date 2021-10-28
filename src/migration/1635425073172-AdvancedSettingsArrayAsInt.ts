import {MigrationInterface, QueryRunner} from "typeorm";

export class AdvancedSettingsArrayAsInt1635425073172 implements MigrationInterface {
    name = 'AdvancedSettingsArrayAsInt1635425073172'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_source_advancedSettings"`);
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "advancedSettings"`);
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "advancedSettings" integer array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_source_advancedSettings" ON "public"."source" ("advancedSettings") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_source_advancedSettings"`);
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "advancedSettings"`);
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "advancedSettings" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE INDEX "IDX_source_advancedSettings" ON "public"."source" ("advancedSettings") `);
    }

}
