import {MigrationInterface, QueryRunner} from "typeorm";

export class TagsInPost1595059874588 implements MigrationInterface {
    name = 'TagsInPost1595059874588'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "public"."post" ADD "tagsStr" text`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_tags" ON "public"."post" ("tagsStr") `, undefined);
        await queryRunner.query(`update "public"."post" set "tagsStr" = res.str from (select pt."postId", array_to_string((array_agg(pt.tag order by tc.count desc, pt.tag))[1:5] , ',') str from post_tag pt inner join tag_count tc on pt.tag = tc.tag and tc.count > 10 group by pt."postId") as res where post.id = res."postId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_tags"`, undefined);
        await queryRunner.query(`ALTER TABLE "public"."post" DROP COLUMN "tagsStr"`, undefined);
    }

}
