import {MigrationInterface, QueryRunner} from "typeorm";

export class SentAnalyticsReport1602762420580 implements MigrationInterface {
    name = 'SentAnalyticsReport1602762420580'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "sentAnalyticsReport" boolean NOT NULL DEFAULT true`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_user_sentAnalyticsReport" ON "public"."post" ("sentAnalyticsReport") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_user_sentAnalyticsReport"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "sentAnalyticsReport"`, undefined);
    }

}
