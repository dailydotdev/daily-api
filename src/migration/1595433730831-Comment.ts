import {MigrationInterface, QueryRunner} from "typeorm";

export class Comment1595433730831 implements MigrationInterface {
    name = 'Comment1595433730831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "public"."comment" ("id" character varying(14) NOT NULL, "postId" text NOT NULL, "userId" character varying(36) NOT NULL, "parentId" character varying(14), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "content" text NOT NULL, "upvotes" integer NOT NULL DEFAULT 0, "comments" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_fb009bc37e653db9f0a22969c42" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_comment_post_id" ON "public"."comment" ("postId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_comment_user_id" ON "public"."comment" ("userId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_comment_parent_id" ON "public"."comment" ("parentId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_comment_upvotes" ON "public"."comment" ("upvotes") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_comment_comments" ON "public"."comment" ("comments") `, undefined);
        await queryRunner.query(`CREATE TABLE "public"."comment_upvote" ("commentId" character varying(14) NOT NULL, "userId" character varying(36) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7231c30e43b9e30842910a01d97" PRIMARY KEY ("commentId", "userId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a719456a191b6f8a42e4ae96d9" ON "public"."comment_upvote" ("commentId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_78b22c2fb692b073d4e6d16586" ON "public"."comment_upvote" ("userId") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "comments" integer NOT NULL DEFAULT 0`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."upvote" ALTER COLUMN "userId" TYPE character varying(36)`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_comments" ON "public"."post" ("comments") `, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" ADD CONSTRAINT "FK_d82dbf00f15d651edf917c8167f" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" ADD CONSTRAINT "FK_f1305337f54e8211d5a84da0cc5" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" ADD CONSTRAINT "FK_cb2ce95b74f2ee583447362d508" FOREIGN KEY ("parentId") REFERENCES "public"."comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment_upvote" ADD CONSTRAINT "FK_a719456a191b6f8a42e4ae96d91" FOREIGN KEY ("commentId") REFERENCES "public"."comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment_upvote" ADD CONSTRAINT "FK_78b22c2fb692b073d4e6d165867" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."comment_upvote" DROP CONSTRAINT "FK_78b22c2fb692b073d4e6d165867"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment_upvote" DROP CONSTRAINT "FK_a719456a191b6f8a42e4ae96d91"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" DROP CONSTRAINT "FK_cb2ce95b74f2ee583447362d508"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" DROP CONSTRAINT "FK_f1305337f54e8211d5a84da0cc5"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."comment" DROP CONSTRAINT "FK_d82dbf00f15d651edf917c8167f"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_post_comments"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_673af2e16c3f34ad564e8f2d14"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."upvote" ALTER COLUMN "userId" TYPE character varying`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "comments"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_78b22c2fb692b073d4e6d16586"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a719456a191b6f8a42e4ae96d9"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."comment_upvote"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_comments"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_upvotes"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_parent_id"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_user_id"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_comment_post_id"`, undefined);
        await queryRunner.query(`DROP TABLE "public"."comment"`, undefined);
    }

}
