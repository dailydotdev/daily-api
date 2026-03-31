import { Index, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'user_similarity_view',
  materialized: true,
  expression: `
    WITH ranked_user_tags AS (
      SELECT
        "userId",
        tag,
        count,
        row_number() OVER (
          PARTITION BY "userId"
          ORDER BY count DESC, tag ASC
        ) AS rn
      FROM user_tag_view
    ),
    tag_overlaps AS (
      SELECT
        left_tags."userId" AS "userId",
        right_tags."userId" AS "similarUserId",
        count(*) AS count
      FROM ranked_user_tags left_tags
      JOIN ranked_user_tags right_tags
        ON left_tags.tag = right_tags.tag
       AND left_tags."userId" != right_tags."userId"
      WHERE left_tags.rn <= 10
        AND right_tags.rn <= 10
      GROUP BY 1, 2
    ),
    ranked_similar_users AS (
      SELECT
        "userId",
        "similarUserId",
        count,
        row_number() OVER (
          PARTITION BY "userId"
          ORDER BY count DESC, "similarUserId" ASC
        ) AS rn
      FROM tag_overlaps
    )
    SELECT
      "userId",
      "similarUserId",
      count
    FROM ranked_similar_users
    WHERE rn <= 6
  `,
})
@Index('UQ_userSimilarity_userId_similarUserId', ['userId', 'similarUserId'], {
  unique: true,
})
export class UserSimilarityView {
  @ViewColumn()
  userId: string;

  @ViewColumn()
  similarUserId: string;

  @ViewColumn()
  count: number;
}
