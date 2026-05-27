import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostNicheTrigger1779883630763 implements MigrationInterface {
  name = 'PostNicheTrigger1779883630763';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /*
     * Function: post_niche_recompute(post_id, tags_str)
     *
     * Derives the post's niches from its (canonical) tagsStr by aggregating
     * the niches of its labeled tags via weighted vote, and rewrites the
     * corresponding rows in post_niche.
     *
     * Score model (see docs/feed-niche-taxonomy.md):
     *   score(post, niche) = SUM over labeled tags of:
     *       weightMultiplier(tag)
     *       * ecosystem_boost(niche)              -- 1.4 for ecosystem, 1.0 for theme
     *       * { 1.0 if tag.primary  == niche,
     *           0.5 if tag.secondary == niche }
     *
     *   primary   = argmax niche
     *   secondary = next-highest niche where score >= 0.35 * primary_score
     *               AND labeled_tag_count >= 2
     *   fallback (no labeled tags) = niche with slug 'other'
     *
     * Callable directly for backfill:
     *   SELECT post_niche_recompute(id, "tagsStr") FROM post WHERE ...
     */
    await queryRunner.query(/* sql */ `
      CREATE OR REPLACE FUNCTION post_niche_recompute(
        p_post_id text,
        p_tags_str text
      ) RETURNS void AS $$
      DECLARE
        c_ecosystem_boost        CONSTANT real := 1.4;
        c_secondary_threshold    CONSTANT real := 0.35;
        c_min_tags_for_secondary CONSTANT int  := 2;
        c_fallback_slug          CONSTANT text := 'other';
        v_primary_id     uuid;
        v_primary_score  real;
        v_secondary_id   uuid;
        v_secondary_score real;
        v_labeled_count  int;
      BEGIN
        DELETE FROM post_niche WHERE "postId" = p_post_id;

        IF p_tags_str IS NULL OR p_tags_str = '' THEN
          INSERT INTO post_niche ("postId", "nicheId", "rank", "score")
          SELECT p_post_id, id, 1, NULL FROM niche WHERE slug = c_fallback_slug;
          RETURN;
        END IF;

        WITH tags_arr AS (
          SELECT trim(t) AS tag
          FROM unnest(string_to_array(p_tags_str, ',')) AS t
          WHERE trim(t) <> ''
        ),
        labeled AS (
          SELECT kn."primaryNicheId" AS niche_id,
                 kn."secondaryNicheId" AS sec_id,
                 kn."weightMultiplier" AS wm
          FROM tags_arr t
          JOIN keyword_niche kn ON kn.keyword = t.tag
        ),
        contribs AS (
          SELECT l.niche_id,
                 l.wm * CASE WHEN n."bucketGroup" = 'ecosystem'
                             THEN c_ecosystem_boost ELSE 1.0 END AS w
          FROM labeled l JOIN niche n ON n.id = l.niche_id
          UNION ALL
          SELECT l.sec_id AS niche_id,
                 0.5 * l.wm * CASE WHEN n."bucketGroup" = 'ecosystem'
                                    THEN c_ecosystem_boost ELSE 1.0 END AS w
          FROM labeled l JOIN niche n ON n.id = l.sec_id
          WHERE l.sec_id IS NOT NULL
        ),
        scored AS (
          SELECT niche_id, SUM(w)::real AS score
          FROM contribs GROUP BY niche_id
        ),
        ranked AS (
          SELECT niche_id, score,
                 ROW_NUMBER() OVER (ORDER BY score DESC, niche_id) AS rnk
          FROM scored
        )
        SELECT
          (SELECT niche_id FROM ranked WHERE rnk = 1),
          (SELECT score    FROM ranked WHERE rnk = 1),
          (SELECT niche_id FROM ranked WHERE rnk = 2),
          (SELECT score    FROM ranked WHERE rnk = 2),
          (SELECT COUNT(*) FROM labeled)
        INTO
          v_primary_id, v_primary_score,
          v_secondary_id, v_secondary_score,
          v_labeled_count;

        IF v_primary_id IS NULL THEN
          INSERT INTO post_niche ("postId", "nicheId", "rank", "score")
          SELECT p_post_id, id, 1, NULL FROM niche WHERE slug = c_fallback_slug;
          RETURN;
        END IF;

        INSERT INTO post_niche ("postId", "nicheId", "rank", "score")
        VALUES (p_post_id, v_primary_id, 1, v_primary_score);

        IF v_secondary_id IS NOT NULL
           AND v_secondary_score >= c_secondary_threshold * v_primary_score
           AND v_labeled_count   >= c_min_tags_for_secondary THEN
          INSERT INTO post_niche ("postId", "nicheId", "rank", "score")
          VALUES (p_post_id, v_secondary_id, 2, v_secondary_score);
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    /*
     * Trigger wrapper — fires on post INSERT and on UPDATE OF "tagsStr"
     * (the latter only when the value actually changed).
     */
    await queryRunner.query(/* sql */ `
      CREATE OR REPLACE FUNCTION post_niche_trigger_function()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM post_niche_recompute(NEW.id, NEW."tagsStr");
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(/* sql */ `
      CREATE TRIGGER post_niche_insert_trigger
      AFTER INSERT ON post
      FOR EACH ROW
      EXECUTE FUNCTION post_niche_trigger_function();
    `);

    await queryRunner.query(/* sql */ `
      CREATE TRIGGER post_niche_update_trigger
      AFTER UPDATE OF "tagsStr" ON post
      FOR EACH ROW
      WHEN (NEW."tagsStr" IS DISTINCT FROM OLD."tagsStr")
      EXECUTE FUNCTION post_niche_trigger_function();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS post_niche_update_trigger ON "post"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS post_niche_insert_trigger ON "post"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS post_niche_trigger_function`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS post_niche_recompute(text, text)`);
  }
}
