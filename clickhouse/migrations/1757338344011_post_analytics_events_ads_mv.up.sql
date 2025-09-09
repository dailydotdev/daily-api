-- up

CREATE MATERIALIZED VIEW IF NOT EXISTS api.post_analytics_events_ads_mv
TO api.post_analytics
AS
SELECT
	c."postId" AS post_id,
	sum(toUInt64(1)) AS impressions_ads,
	uniqState(user_id) AS reach_all,
	uniqState(user_id) AS reach_ads,
	max(event_timestamp) AS created_at
FROM
	skadi.ad_impressions sai
ANY LEFT JOIN api.campaign c FINAL
ON
	toString(c.id) = campaign_id
WHERE
	c."postId" != ''
	AND c."postId" IS NOT NULL
	AND event_timestamp > '2025-09-08 13:54:00'
GROUP BY
	c."postId"
SETTINGS materialized_views_ignore_errors = 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS api.post_analytics_history_events_ads_daily_mv
TO api.post_analytics_history
AS
SELECT
	c."postId" AS post_id,
  	toDate(event_timestamp) AS date,
	sum(toUInt64(1)) AS impressions_ads,
	max(event_timestamp) AS created_at
FROM
	skadi.ad_impressions sai
ANY LEFT JOIN api.campaign c FINAL
ON
	toString(c.id) = campaign_id
WHERE
	c."postId" != ''
	AND c."postId" IS NOT NULL
	AND event_timestamp > '2025-09-08 13:58:00'
GROUP BY
	date, c."postId"
SETTINGS materialized_views_ignore_errors = 1;
