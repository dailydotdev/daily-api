import {MigrationInterface, QueryRunner} from "typeorm";

export class EcoDefault1609057573320 implements MigrationInterface {
    name = 'EcoDefault1609057573320'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ALTER COLUMN "spaciness" SET DEFAULT 'eco'`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."settings" ALTER COLUMN "spaciness" SET DEFAULT 'roomy'`, undefined);
    }

}
