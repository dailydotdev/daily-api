import { MigrationInterface, QueryRunner } from "typeorm";

export class PostCollection1700064380738 implements MigrationInterface {
    name = 'PostCollection1700064380738'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "post_relation" ("postId" text NOT NULL, "relatedPostId" text NOT NULL, "type" text NOT NULL DEFAULT 'collection', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3c7baca0d95a20fdaa76593301b" PRIMARY KEY ("postId", "relatedPostId", "type"))`);
        await queryRunner.query(`CREATE INDEX "IDX_post_relation_post_id_related_post_id_type_created_at" ON "post_relation" ("postId", "relatedPostId", "type", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "post_relation" ADD CONSTRAINT "FK_047c6c6dfe33e269ca2754e29a9" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_relation" ADD CONSTRAINT "FK_0950b72419f03dba7e68ef326a2" FOREIGN KEY ("relatedPostId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_relation" DROP CONSTRAINT "FK_0950b72419f03dba7e68ef326a2"`);
        await queryRunner.query(`ALTER TABLE "post_relation" DROP CONSTRAINT "FK_047c6c6dfe33e269ca2754e29a9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_relation_post_id_related_post_id_type_created_at"`);
        await queryRunner.query(`DROP TABLE "post_relation"`);
    }

}
