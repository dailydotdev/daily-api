import {MigrationInterface, QueryRunner} from "typeorm";

export class AlertEntity1634525137005 implements MigrationInterface {
    name = 'AlertEntity1634525137005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."alert" ("userId" text NOT NULL, "filter" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_0c086da7856a810686e3cdd90b6" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0c086da7856a810686e3cdd90b" ON "public"."alert" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0c086da7856a810686e3cdd90b"`);
        await queryRunner.query(`DROP TABLE "public"."alert"`);
    }

}
