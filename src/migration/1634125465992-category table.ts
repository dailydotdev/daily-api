import {MigrationInterface, QueryRunner} from "typeorm";

export class categoryTable1634125465992 implements MigrationInterface {
    name = 'categoryTable1634125465992'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."category_keyword" ("categoryId" text NOT NULL, "keyword" text NOT NULL, CONSTRAINT "PK_88a8d0250502d17a164f91dcfd3" PRIMARY KEY ("categoryId", "keyword"))`);
        await queryRunner.query(`CREATE INDEX "IDX_003f12a6c0ccb51aca7d6855bf" ON "public"."category_keyword" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b23019808bd459545f43865750" ON "public"."category_keyword" ("keyword") `);
        await queryRunner.query(`CREATE TABLE "public"."category" ("id" text NOT NULL, "value" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2fd3397138f6f29d0cdad6ba06" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_category_id" ON "public"."category" ("id") `);
        await queryRunner.query(`CREATE INDEX "IDX_349e1659c01cbc1c8d463a46ec" ON "public"."category" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_category_updatedAt" ON "public"."category" ("updatedAt") `);
        await queryRunner.query(`ALTER TABLE "public"."keyword" DROP COLUMN "categories"`);
        await queryRunner.query(`ALTER TABLE "public"."category_keyword" ADD CONSTRAINT "FK_003f12a6c0ccb51aca7d6855bf6" FOREIGN KEY ("categoryId") REFERENCES "public"."category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."category_keyword" DROP CONSTRAINT "FK_003f12a6c0ccb51aca7d6855bf6"`);
        await queryRunner.query(`ALTER TABLE "public"."keyword" ADD "categories" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_category_updatedAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_349e1659c01cbc1c8d463a46ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_category_id"`);
        await queryRunner.query(`DROP TABLE "public"."category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b23019808bd459545f43865750"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_003f12a6c0ccb51aca7d6855bf"`);
        await queryRunner.query(`DROP TABLE "public"."category_keyword"`);
    }

}
