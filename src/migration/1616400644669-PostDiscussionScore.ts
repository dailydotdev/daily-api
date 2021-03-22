import {MigrationInterface, QueryRunner} from "typeorm";

export class PostDiscussionScore1616400644669 implements MigrationInterface {
    name = 'PostDiscussionScore1616400644669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "discussionScore" integer`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_post_discussion_score" ON "public"."post" ("discussionScore") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_post_discussion_score"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "discussionScore"`, undefined);
    }

}
