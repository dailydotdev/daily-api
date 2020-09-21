import {MigrationInterface, QueryRunner} from "typeorm";

export class Username1600691199678 implements MigrationInterface {
    name = 'Username1600691199678'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "username" character varying(15)`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "twitter" character varying(15)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b67337b7f8aa8406e936c2ff75" ON "public"."user" ("username") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d7820fad49c99eb918d92519e2" ON "public"."user" ("twitter") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d7820fad49c99eb918d92519e2"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b67337b7f8aa8406e936c2ff75"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "twitter"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "username"`, undefined);
    }

}
