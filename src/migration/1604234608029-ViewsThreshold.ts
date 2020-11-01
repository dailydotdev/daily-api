import {MigrationInterface, QueryRunner} from "typeorm";

export class ViewsThreshold1604234608029 implements MigrationInterface {
    name = 'ViewsThreshold1604234608029'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "viewsThreshold" integer NOT NULL DEFAULT 0`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_viewsThreshold" ON "public"."post" ("viewsThreshold") `, undefined);
        await queryRunner.query('UPDATE "public"."post" SET "viewsThreshold" = 1 WHERE "views" >= 250');
      await queryRunner.query('UPDATE "public"."post" SET "viewsThreshold" = 2 WHERE "views" >= 500');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_viewsThreshold"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "viewsThreshold"`, undefined);
    }

}
