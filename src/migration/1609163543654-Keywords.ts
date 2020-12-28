import {MigrationInterface, QueryRunner} from "typeorm";

export class Keywords1609163543654 implements MigrationInterface {
    name = 'Keywords1609163543654'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."keyword_status_enum" AS ENUM('pending', 'allow', 'deny')`, undefined);
        await queryRunner.query(`CREATE TABLE "public"."keyword" ("value" text NOT NULL, "status" "public"."keyword_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c1e9d5c74cdd352fc32f8a3fb73" PRIMARY KEY ("value"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_value" ON "public"."keyword" ("value") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_status" ON "public"."keyword" ("status") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_keyword_createdAt" ON "public"."keyword" ("createdAt") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."post_keyword" ("postId" text NOT NULL, "keyword" text NOT NULL, CONSTRAINT "PK_37fc8524ce431ed7422cb092352" PRIMARY KEY ("postId", "keyword"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_keyword_postId" ON "public"."post_keyword" ("postId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_keyword_keyword" ON "public"."post_keyword" ("keyword") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post_keyword" ADD CONSTRAINT "FK_88d97436b07e1462d5a7877dcb3" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post_keyword" DROP CONSTRAINT "FK_88d97436b07e1462d5a7877dcb3"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_keyword_keyword"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_keyword_postId"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."post_keyword"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_createdAt"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_status"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_keyword_value"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."keyword"`, undefined);
        await queryRunner.query(`DROP TYPE "public"."keyword_status_enum"`, undefined);
    }

}
