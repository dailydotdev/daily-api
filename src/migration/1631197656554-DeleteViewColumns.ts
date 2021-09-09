import {MigrationInterface, QueryRunner} from "typeorm";

export class DeleteViewColumns1631197656554 implements MigrationInterface {
    name = 'DeleteViewColumns1631197656554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" DROP COLUMN "agent"`);
        await queryRunner.query(`ALTER TABLE "public"."view" DROP COLUMN "ip"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."view" ADD "ip" text`);
        await queryRunner.query(`ALTER TABLE "public"."view" ADD "agent" text`);
    }

}
