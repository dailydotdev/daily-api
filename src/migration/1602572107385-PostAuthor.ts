import {MigrationInterface, QueryRunner} from "typeorm";

export class PostAuthor1602572107385 implements MigrationInterface {
    name = 'PostAuthor1602572107385'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."user" ADD "profileConfirmed" boolean NOT NULL DEFAULT false`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "authorId" character varying(36)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_user_profileConfirmed" ON "public"."user" ("profileConfirmed") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_author" ON "public"."post" ("authorId") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD CONSTRAINT "FK_f1bb0e9a2279673a76520d2adc5" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" DROP CONSTRAINT "FK_f1bb0e9a2279673a76520d2adc5"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_author"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_profileConfirmed"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "authorId"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."user" DROP COLUMN "profileConfirmed"`, undefined);
    }

}
