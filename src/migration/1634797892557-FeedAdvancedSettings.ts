import {MigrationInterface, QueryRunner} from "typeorm";

export class FeedAdvancedSettings1634797892557 implements MigrationInterface {
    name = 'FeedAdvancedSettings1634797892557'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."advanced_settings" ("id" text NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "state" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_dbd69e3f34b66d13d8772a2c4a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_advancedSettings_id" ON "public"."advanced_settings" ("id") `);
        await queryRunner.query(`CREATE TABLE "public"."feed_advanced_settings" ("feedId" text NOT NULL, "advancedSettingsId" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_3a8d7e5b1a44aff91cbe61b1e95" PRIMARY KEY ("feedId", "advancedSettingsId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_01d5bc49fc5802c4e067d7ba4c" ON "public"."feed_advanced_settings" ("feedId") `);
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "advancedSettings" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "public"."feed_advanced_settings" ADD CONSTRAINT "FK_01d5bc49fc5802c4e067d7ba4c9" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "public"."feed_advanced_settings" ADD CONSTRAINT "FK_c46745c935040ef6188c9cbf013" FOREIGN KEY ("advancedSettingsId") REFERENCES "public"."advanced_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."feed_advanced_settings" DROP CONSTRAINT "FK_c46745c935040ef6188c9cbf013"`);
        await queryRunner.query(`ALTER TABLE "public"."feed_advanced_settings" DROP CONSTRAINT "FK_01d5bc49fc5802c4e067d7ba4c9"`);
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "advancedSettings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_01d5bc49fc5802c4e067d7ba4c"`);
        await queryRunner.query(`DROP TABLE "public"."feed_advanced_settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advancedSettings_id"`);
        await queryRunner.query(`DROP TABLE "public"."advanced_settings"`);
    }

}
