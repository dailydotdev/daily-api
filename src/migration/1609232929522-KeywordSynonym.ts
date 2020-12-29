import {MigrationInterface, QueryRunner} from "typeorm";

export class KeywordSynonym1609232929522 implements MigrationInterface {
    name = 'KeywordSynonym1609232929522'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_createdAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "synonym" text`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "status"`, undefined);
        await queryRunner.query(`DROP TYPE "public"."keyword_status_enum"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "status" character varying NOT NULL DEFAULT 'pending'`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status" ON "public"."keyword" ("status") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_updatedAt" ON "public"."keyword" ("updatedAt") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_updatedAt"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "status"`, undefined);
        await queryRunner.query(`CREATE TYPE "public"."keyword_status_enum" AS ENUM('pending', 'allow', 'deny')`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "status" "public"."keyword_status_enum" NOT NULL DEFAULT 'pending'`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status" ON "public"."keyword" ("status") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "updatedAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "synonym"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_createdAt" ON "public"."keyword" ("createdAt") `, undefined);
    }

}
