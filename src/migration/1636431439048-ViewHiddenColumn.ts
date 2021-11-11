import {MigrationInterface, QueryRunner} from "typeorm";

export class ViewHiddenColumn1636431439048 implements MigrationInterface {
    name = 'ViewHiddenColumn1636431439048'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" ADD "hidden" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" DROP COLUMN "hidden"`);
    }

}
