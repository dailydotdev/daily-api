import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops 29 indexes that were removed live from production on 2026-06-22 during
 * DB housekeeping: 13 duplicates (byte-redundant with a PK/unique on identical
 * columns) and 16 unused indexes (zero planner scans on the primary and both
 * read replicas over a 175-day window, re-verified with no regression after the
 * drop). This migration syncs the schema/entities to match production.
 */
export class DropUnusedIndexes1782300000000 implements MigrationInterface {
  name = 'DropUnusedIndexes1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP INDEX IF EXISTS "public"."IDX_85dda8e9982027f27696273a20";
      DROP INDEX IF EXISTS "public"."IDX_archive_item_archive_id_subject_id";
      DROP INDEX IF EXISTS "public"."UNQ_content_preference_dev_2";
      DROP INDEX IF EXISTS "public"."IDX_feed_slug";
      DROP INDEX IF EXISTS "public"."IDX_keyword_value";
      DROP INDEX IF EXISTS "public"."idx_keyword_status_occ_value";
      DROP INDEX IF EXISTS "public"."IDX_comment_flags_vordr";
      DROP INDEX IF EXISTS "public"."IDX_source_post_moderation_flags_vordr";
      DROP INDEX IF EXISTS "public"."IDX_d8e3aa07a95560a445ad50fb93";
      DROP INDEX IF EXISTS "public"."IDX_source_category_slug";
      DROP INDEX IF EXISTS "public"."IDX_9c7d2a40fc3deac4d66155997c";
      DROP INDEX IF EXISTS "public"."IDX_user_hot_take_hotTakeId_userId";
      DROP INDEX IF EXISTS "public"."IDX_45cdc90ca0fd4cf0f8e8026e39";
      DROP INDEX IF EXISTS "public"."IDX_post_analytics_history_updatedAt_desc";
      DROP INDEX IF EXISTS "public"."feed_tag_tag_index";
      DROP INDEX IF EXISTS "public"."IDX_c04e86377257df2a6a4181421f";
      DROP INDEX IF EXISTS "public"."IDX_content_preference_flags_referralToken";
      DROP INDEX IF EXISTS "public"."IDX_user_referral_origin";
      DROP INDEX IF EXISTS "public"."IDX_046c0e003ac6b74dd7c2ee2909";
      DROP INDEX IF EXISTS "public"."user_idx_lowerusername_username";
      DROP INDEX IF EXISTS "public"."IDX_post_flags_promoteToPublic";
      DROP INDEX IF EXISTS "public"."IDX_post_downvotes";
      DROP INDEX IF EXISTS "public"."IDX_post_discussion_score";
      DROP INDEX IF EXISTS "public"."IDX_post_banned";
      DROP INDEX IF EXISTS "public"."IDX_post_viewsThreshold";
      DROP INDEX IF EXISTS "public"."IDX_user_flags_vordr";
      DROP INDEX IF EXISTS "public"."IDX_39740d60f36a9779356d6019b2";
      DROP INDEX IF EXISTS "public"."IDX_user_subflags_organizationid";
      DROP INDEX IF EXISTS "public"."IDX_keyword_occurrences";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE INDEX IF NOT EXISTS "IDX_85dda8e9982027f27696273a20" ON "alerts" ("userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_archive_item_archive_id_subject_id" ON "archive_item" ("archiveId", "subjectId");
      CREATE UNIQUE INDEX IF NOT EXISTS "UNQ_content_preference_dev_2" ON "content_preference" ("referenceId", "userId", "type", "feedId");
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_feed_slug" ON "feed" ("slug");
      CREATE INDEX IF NOT EXISTS "IDX_keyword_value" ON "keyword" ("value");
      CREATE INDEX IF NOT EXISTS "idx_keyword_status_occ_value" ON "keyword" ("status", "occurrences", "value");
      CREATE INDEX IF NOT EXISTS "IDX_comment_flags_vordr" ON "post" ((((flags -> 'vordr'::text))::boolean));
      CREATE INDEX IF NOT EXISTS "IDX_source_post_moderation_flags_vordr" ON "post" ((((flags -> 'vordr'::text))::boolean));
      CREATE INDEX IF NOT EXISTS "IDX_d8e3aa07a95560a445ad50fb93" ON "prompt" ("id");
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_source_category_slug" ON "source_category" ("slug");
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_9c7d2a40fc3deac4d66155997c" ON "user_comment" ("commentId", "userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_hot_take_hotTakeId_userId" ON "user_hot_take" ("hotTakeId", "userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_45cdc90ca0fd4cf0f8e8026e39" ON "user_post" ("postId", "userId");
      CREATE INDEX IF NOT EXISTS "IDX_post_analytics_history_updatedAt_desc" ON "post_analytics_history" ("updatedAt" DESC);
      CREATE INDEX IF NOT EXISTS "feed_tag_tag_index" ON "feed_tag" ("tag");
      CREATE INDEX IF NOT EXISTS "IDX_c04e86377257df2a6a4181421f" ON "feed_tag" ("updatedAt");
      CREATE INDEX IF NOT EXISTS "IDX_content_preference_flags_referralToken" ON "content_preference" (((flags ->> 'referralToken'::text)));
      CREATE INDEX IF NOT EXISTS "IDX_user_referral_origin" ON "user" ("referralOrigin");
      CREATE INDEX IF NOT EXISTS "IDX_046c0e003ac6b74dd7c2ee2909" ON "user_personalized_digest" ("preferredDay");
      CREATE INDEX IF NOT EXISTS "user_idx_lowerusername_username" ON "user" (lower((username)::text), "username");
      CREATE INDEX IF NOT EXISTS "IDX_post_flags_promoteToPublic" ON "post" ((((flags ->> 'promoteToPublic'::text))::integer));
      CREATE INDEX IF NOT EXISTS "IDX_post_downvotes" ON "post" ("downvotes");
      CREATE INDEX IF NOT EXISTS "IDX_post_discussion_score" ON "post" ("discussionScore");
      CREATE INDEX IF NOT EXISTS "IDX_post_banned" ON "post" ("banned");
      CREATE INDEX IF NOT EXISTS "IDX_post_viewsThreshold" ON "post" ("viewsThreshold");
      CREATE INDEX IF NOT EXISTS "IDX_user_flags_vordr" ON "post" USING hash ((((flags -> 'vordr'::text))::boolean));
      CREATE INDEX IF NOT EXISTS "IDX_39740d60f36a9779356d6019b2" ON "user" ("coresRole");
      CREATE INDEX IF NOT EXISTS "IDX_user_subflags_organizationid" ON "user" ((("subscriptionFlags" ->> 'organizationId'::text)));
      CREATE INDEX IF NOT EXISTS "IDX_keyword_occurrences" ON "keyword" ("occurrences");
    `);
  }
}
