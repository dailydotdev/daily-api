import {MigrationInterface, QueryRunner} from "typeorm";

export class BookmarkList1590596508994 implements MigrationInterface {
    name = 'BookmarkList1590596508994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."bookmark_list" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" text NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_99af0f19f332daded98d815d533" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_98fb54808b8069599e9ebc73f2" ON "public"."bookmark_list" ("userId") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD "listId" uuid`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_5a7c74084b06b4a08961de754c" ON "public"."bookmark" ("listId") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" ADD CONSTRAINT "FK_5a7c74084b06b4a08961de754cd" FOREIGN KEY ("listId") REFERENCES "public"."bookmark_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP CONSTRAINT "FK_5a7c74084b06b4a08961de754cd"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a7c74084b06b4a08961de754c"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."bookmark" DROP COLUMN "listId"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_98fb54808b8069599e9ebc73f2"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."bookmark_list"`, undefined);
    }

}
