import {MigrationInterface, QueryRunner} from "typeorm";

export class FeedArticleTypeEntity1634283423793 implements MigrationInterface {
    name = 'FeedArticleTypeEntity1634283423793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_690e8ea58d0aa6f5d21f10f97c"`);
        await queryRunner.query(`CREATE TABLE "public"."feed_article_type" ("feedId" text NOT NULL, "articleTypeId" text NOT NULL, CONSTRAINT "PK_e5ee16630d2c769b376424457e0" PRIMARY KEY ("feedId", "articleTypeId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_66c860716531685ec10918afa1" ON "public"."feed_article_type" ("feedId") `);
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "editorialId"`);
        await queryRunner.query(`ALTER TABLE "public"."article_type" DROP COLUMN "emoji"`);
        await queryRunner.query(`CREATE INDEX "IDX_e19b348d09248d3ddffcb461b1" ON "public"."source" ("articleTypeId") `);
        await queryRunner.query(`ALTER TABLE "public"."feed_article_type" ADD CONSTRAINT "FK_66c860716531685ec10918afa1e" FOREIGN KEY ("feedId") REFERENCES "public"."feed"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "public"."feed_article_type" ADD CONSTRAINT "FK_47a507449ada2e22d42a4a9b8fe" FOREIGN KEY ("articleTypeId") REFERENCES "public"."article_type"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."feed_article_type" DROP CONSTRAINT "FK_47a507449ada2e22d42a4a9b8fe"`);
        await queryRunner.query(`ALTER TABLE "public"."feed_article_type" DROP CONSTRAINT "FK_66c860716531685ec10918afa1e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e19b348d09248d3ddffcb461b1"`);
        await queryRunner.query(`ALTER TABLE "public"."article_type" ADD "emoji" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "editorialId" text`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66c860716531685ec10918afa1"`);
        await queryRunner.query(`DROP TABLE "public"."feed_article_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_690e8ea58d0aa6f5d21f10f97c" ON "public"."source" ("editorialId") `);
    }

}
