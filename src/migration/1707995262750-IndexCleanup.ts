import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexCleanup1707995262750 implements MigrationInterface {
  name = 'IndexCleanup1707995262750';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5a7c74084b06b4a08961de754c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_98fb54808b8069599e9ebc73f2"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_category_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comment_comments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_comment_featured"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_comment_report_comment_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_content_image_created_at_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a4b909c4059f55ddaed1e82a8d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c6d05462bc68459e00f165d51"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65a9ca0600dbc72c6ff76501a6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_83c8ae07417cd6de65b8b99458"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_post_last_trending"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_tsv"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_deleted"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31d41971830ac861579df2b064"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_active_private_image"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_advancedSettings"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad5e759962cd86ff322cb480d0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d4ab881c900e50757d4e987fc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f708e773c1df9c288180fbb55"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_userId_flags_hideFeedPosts"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8ab0b23c8504bc0488d7f18317"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d3873a44af34c69e1fef77ba0b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_tag_count_count"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tag_count_tag_search"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_434222b69243c6c160201e8841"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_user_profileConfirmed"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_5a7c74084b06b4a08961de754c" ON "bookmark" ("listId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_98fb54808b8069599e9ebc73f2" ON "bookmark_list" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_category_id" ON "category" ("id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_featured" ON "comment" ("featured") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_comments" ON "comment" ("comments") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_report_comment_id" ON "comment_report" ("commentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_content_image_created_at_type" ON "content_image" ("createdAt", "usedByType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a4b909c4059f55ddaed1e82a8d" ON "feed_tag" ("tag") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c6d05462bc68459e00f165d51" ON "feed_tag" ("feedId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65a9ca0600dbc72c6ff76501a6" ON "notification_preference" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_83c8ae07417cd6de65b8b99458" ON "post" ("sourceId") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_post_tsv" ON "post" ("tsv") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_last_trending" ON "post" ("lastTrending") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_deleted" ON "post" ("deleted") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31d41971830ac861579df2b064" ON "source" ("active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_active_private_image" ON "source" ("active", "image", "private") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_advancedSettings" ON "source" ("advancedSettings") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad5e759962cd86ff322cb480d0" ON "source_display" ("sourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d4ab881c900e50757d4e987fc" ON "source_display" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f708e773c1df9c288180fbb55" ON "source_feed" ("sourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_member_userId_flags_hideFeedPosts" ON "source_member" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8ab0b23c8504bc0488d7f18317" ON "source_request" ("closed", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d3873a44af34c69e1fef77ba0b" ON "source_request" ("approved", "closed", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tag_count_count" ON "public"."tag_count" ("count" DESC)`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tag_count_tag_search" ON "public"."tag_count" USING gin("tag" gin_trgm_ops)`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_434222b69243c6c160201e8841" ON "tag_segment" ("segment") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_profileConfirmed" ON "user" ("profileConfirmed") `,
    );
  }
}
