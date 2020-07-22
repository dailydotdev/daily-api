import {MigrationInterface, QueryRunner} from "typeorm";

export class Upvote1595424192556 implements MigrationInterface {
    name = 'Upvote1595424192556'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."upvote" ("postId" text NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_895c43b158fe9d95bc597a98370" PRIMARY KEY ("postId", "userId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_7f9b5f3313a35a7ebc8de1d53e" ON "public"."upvote" ("postId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_673af2e16c3f34ad564e8f2d14" ON "public"."upvote" ("userId") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "upvotes" integer NOT NULL DEFAULT 0`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_upvotes" ON "public"."post" ("upvotes") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."upvote" ADD CONSTRAINT "FK_7f9b5f3313a35a7ebc8de1d53e0" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."upvote" ADD CONSTRAINT "FK_673af2e16c3f34ad564e8f2d144" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."upvote" DROP CONSTRAINT "FK_673af2e16c3f34ad564e8f2d144"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."upvote" DROP CONSTRAINT "FK_7f9b5f3313a35a7ebc8de1d53e0"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_upvotes"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "upvotes"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_673af2e16c3f34ad564e8f2d14"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f9b5f3313a35a7ebc8de1d53e"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."upvote"`, undefined);
    }

}
