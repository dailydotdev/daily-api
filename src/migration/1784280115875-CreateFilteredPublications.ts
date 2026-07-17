import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFilteredPublications1784280115875 implements MigrationInterface {
  name = 'CreateFilteredPublications1784280115875';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      CREATE PUBLICATION "api_debezium_filtered"
        WITH (publish_generated_columns = stored)
    `);

    await queryRunner.query(/* sql */ `
      DO $$
      DECLARE
        publication_tables TEXT;
      BEGIN
        SELECT STRING_AGG(
          FORMAT('%I.%I', namespace.nspname, relation.relname),
          ', ' ORDER BY desired.ordinality
        )
        INTO publication_tables
        FROM UNNEST(ARRAY[
          'comment',
          'user_comment',
          'comment_mention',
          'source_request',
          'post',
          'user',
          'post_report',
          'source_feed',
          'settings',
          'reputation_event',
          'submission',
          'user_state',
          'notification_v2',
          'source_member',
          'feature',
          'source',
          'post_mention',
          'content_image',
          'comment_report',
          'user_post',
          'banner',
          'post_relation',
          'marketing_cta',
          'squad_public_request',
          'user_streak',
          'bookmark',
          'bookmark_list',
          'user_company',
          'source_report',
          'user_top_reader',
          'source_post_moderation',
          'user_report',
          'user_transaction',
          'content_preference',
          'campaign',
          'opportunity_match',
          'opportunity',
          'organization',
          'user_candidate_preference',
          'user_experience',
          'feedback',
          'hot_take',
          'user_stack',
          'quest',
          'quest_reward',
          'quest_rotation',
          'user_quest',
          'user_quest_profile',
          'highlights_canonical',
          'feed',
          'opportunity_user',
          'user_marketing_cta',
          'contribution_submission',
          'heartbeat'
        ]) WITH ORDINALITY AS desired(name, ordinality)
        INNER JOIN pg_catalog.pg_class AS relation
          ON relation.relname = desired.name
          AND relation.relkind IN ('r', 'p')
        INNER JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
          AND namespace.nspname = 'public';

        IF publication_tables IS NOT NULL THEN
          EXECUTE FORMAT(
            'ALTER PUBLICATION %I ADD TABLE %s',
            'api_debezium_filtered',
            publication_tables
          );
        END IF;
      END
      $$
    `);

    await queryRunner.query(/* sql */ `
      CREATE PUBLICATION "clickhouse_sync_filtered"
        WITH (publish_generated_columns = stored)
    `);

    await queryRunner.query(/* sql */ `
      DO $$
      DECLARE
        publication_tables TEXT;
      BEGIN
        SELECT STRING_AGG(
          FORMAT('%I.%I', namespace.nspname, relation.relname),
          ', ' ORDER BY desired.ordinality
        )
        INTO publication_tables
        FROM UNNEST(ARRAY[
          'post',
          'source',
          'keyword',
          'niche',
          'keyword_niche',
          'user',
          'content_preference',
          'post_keyword',
          'post_niche',
          'comment',
          'campaign',
          'post_relation',
          'user_personalized_digest',
          'user_company',
          'highlights_canonical'
        ]) WITH ORDINALITY AS desired(name, ordinality)
        INNER JOIN pg_catalog.pg_class AS relation
          ON relation.relname = desired.name
          AND relation.relkind IN ('r', 'p')
        INNER JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
          AND namespace.nspname = 'public';

        IF publication_tables IS NOT NULL THEN
          EXECUTE FORMAT(
            'ALTER PUBLICATION %I ADD TABLE %s',
            'clickhouse_sync_filtered',
            publication_tables
          );
        END IF;
      END
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP PUBLICATION IF EXISTS "clickhouse_sync_filtered"
    `);

    await queryRunner.query(/* sql */ `
      DROP PUBLICATION IF EXISTS "api_debezium_filtered"
    `);
  }
}
