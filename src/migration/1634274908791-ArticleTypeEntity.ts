import {MigrationInterface, QueryRunner} from "typeorm";

export class ArticleTypeEntity1634274908791 implements MigrationInterface {
    name = 'ArticleTypeEntity1634274908791'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."article_type" ("id" text NOT NULL, "title" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c3c95cd06302002364beb8049f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_article_type_id" ON "public"."article_type" ("id") `);
        await queryRunner.query(`ALTER TABLE "public"."source" ADD "articleTypeId" text`);
        await queryRunner.query(`CREATE INDEX "IDX_690e8ea58d0aa6f5d21f10f97c" ON "public"."source" ("articleTypeId") `);
        await queryRunner.query(`ALTER TABLE "public"."source" ADD CONSTRAINT "FK_e19b348d09248d3ddffcb461b10" FOREIGN KEY ("articleTypeId") REFERENCES "public"."article_type"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."source" DROP CONSTRAINT "FK_e19b348d09248d3ddffcb461b10"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_690e8ea58d0aa6f5d21f10f97c"`);
        await queryRunner.query(`ALTER TABLE "public"."source" DROP COLUMN "articleTypeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_article_type_id"`);
        await queryRunner.query(`DROP TABLE "public"."article_type"`);
    }

}
