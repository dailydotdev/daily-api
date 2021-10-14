import {MigrationInterface, QueryRunner} from "typeorm";

export class TagCategories1634186001253 implements MigrationInterface {
    name = 'TagCategories1634186001253'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."category" ("id" text NOT NULL, "title" text NOT NULL, "emoji" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tags" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_a2fd3397138f6f29d0cdad6ba06" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_category_id" ON "public"."category" ("id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_category_id"`);
        await queryRunner.query(`DROP TABLE "public"."category"`);
    }

}
