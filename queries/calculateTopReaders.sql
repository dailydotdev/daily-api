WITH
views AS (
  SELECT
    "v"."postId",
    "v"."userId",
    "pk"."keyword"
  FROM
    "public"."view" "v"
    INNER JOIN "public"."post_keyword" "pk" ON "v"."postId" = "pk"."postId"
  WHERE
    "pk"."status" = 'allow'
    AND "v"."timestamp" >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')
    -- Example 2024-10-01 00:00:00+00
    AND "v"."timestamp" <  (date_trunc('month', CURRENT_DATE))
    -- Example 2024-11-01 00:00:00+00
),
distinct_views AS (
  SELECT
    "v"."userId",
    "v"."keyword"
  FROM
    "views" "v"
  GROUP BY
    "v"."userId",
    "v"."keyword"
),
top_keywords AS (
  SELECT
    COUNT("dv"."keyword") AS "count",
    "dv"."keyword"
  FROM
    "distinct_views" "dv"
  GROUP BY
    "dv"."keyword"
  HAVING
    COUNT("dv"."keyword") >= $1
    -- Must have at least 500 unique views
  ORDER BY
    "dv"."count" DESC
),
keyword_user_counts AS (
  SELECT
    COUNT(*) AS "userViewCount",
    "v"."keyword",
    "v"."userId"
  FROM
    "views" "v"
  GROUP BY
    "v"."keyword",
    "v"."userId"
),
ranked_users AS (
  SELECT
    ROW_NUMBER() OVER (PARTITION BY "kuc"."keyword" ORDER BY "kuc"."userViewCount" DESC) AS "rank",
    "kuc"."keyword",
    "kuc"."userId",
    "kuc"."userViewCount"
  FROM
    "keyword_user_counts" "kuc"
)
SELECT
  "ru"."keyword",
  ("tk"."count")::int AS "keywordRank",
  "ru"."userId",
  ("ru"."userViewCount")::int,
  ("ru"."rank")::int
FROM
  "ranked_users" "ru"
  INNER JOIN "top_keywords" "tk" ON "tk"."keyword" = "ru"."keyword"
WHERE
  "ru"."rank" <= $2
  -- We need to select a higher amount of users here, so that we can process them server side
  AND EXISTS(SELECT 1 from "user" "u" where "u"."id" = "ru"."userId")
  -- We need to make sure that the user still exists
ORDER BY
  "tk"."count" DESC,
  "ru"."rank" ASC
