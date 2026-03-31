import { Index, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'source_similarity_view',
  materialized: true,
  expression: `
    WITH ranked_source_tags AS (
      SELECT
        "sourceId",
        tag,
        count,
        row_number() OVER (
          PARTITION BY "sourceId"
          ORDER BY count DESC, tag ASC
        ) AS rn
      FROM source_tag_view
    ),
    tag_overlaps AS (
      SELECT
        left_tags."sourceId" AS "sourceId",
        right_tags."sourceId" AS "similarSourceId",
        count(*) AS count
      FROM ranked_source_tags left_tags
      JOIN ranked_source_tags right_tags
        ON left_tags.tag = right_tags.tag
       AND left_tags."sourceId" != right_tags."sourceId"
      WHERE left_tags.rn <= 10
        AND right_tags.rn <= 10
      GROUP BY 1, 2
    ),
    ranked_similar_sources AS (
      SELECT
        "sourceId",
        "similarSourceId",
        count,
        row_number() OVER (
          PARTITION BY "sourceId"
          ORDER BY count DESC, "similarSourceId" ASC
        ) AS rn
      FROM tag_overlaps
    )
    SELECT
      "sourceId",
      "similarSourceId",
      count
    FROM ranked_similar_sources
    WHERE rn <= 6
  `,
})
@Index(
  'UQ_sourceSimilarity_sourceId_similarSourceId',
  ['sourceId', 'similarSourceId'],
  { unique: true },
)
export class SourceSimilarityView {
  @ViewColumn()
  sourceId: string;

  @ViewColumn()
  similarSourceId: string;

  @ViewColumn()
  count: number;
}
