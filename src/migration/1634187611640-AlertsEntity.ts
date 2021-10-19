import {MigrationInterface, QueryRunner} from "typeorm";

export class AlertsEntity1634529340704 implements MigrationInterface {
    name = 'AlertsEntity1634529340704'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."alerts" ("userId" text NOT NULL, "filter" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_85dda8e9982027f27696273a206" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_85dda8e9982027f27696273a20" ON "public"."alerts" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_85dda8e9982027f27696273a20"`);
        await queryRunner.query(`DROP TABLE "public"."alerts"`);
    }

}
