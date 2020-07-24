import {MigrationInterface, QueryRunner} from "typeorm";

export class OpenNewTabSetting1595072041410 implements MigrationInterface {
    name = 'OpenNewTabSetting1595072041410'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ADD "openNewTab" boolean NOT NULL DEFAULT true`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" DROP COLUMN "openNewTab"`, undefined);
    }

}
