import {MigrationInterface, QueryRunner} from "typeorm";

export class ActiveSources1602427333872 implements MigrationInterface {
    name = 'ActiveSources1602427333872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "active" boolean NOT NULL DEFAULT true`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_31d41971830ac861579df2b064" ON "public"."source" ("active") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_31d41971830ac861579df2b064"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "active"`, undefined);
    }

}
