-- up

ALTER TABLE api.post_analytics
    ADD COLUMN IF NOT EXISTS clicks SimpleAggregateFunction(sum, UInt64) DEFAULT 0;

ALTER TABLE api.post_analytics
    ADD COLUMN IF NOT EXISTS clicks_ads SimpleAggregateFunction(sum, UInt64) DEFAULT 0;

ALTER TABLE api.post_analytics_events_mv
MODIFY QUERY
SELECT
	target_id AS post_id,
	sumIf(toUInt64(1), event_name = 'share post') AS shares_external,
	sumIf(toUInt64(1), event_name = 'share to squad') AS shares_internal,
	uniqStateIf(user_id, event_name = 'bookmark post') AS bookmarks,
	sumIf(toUInt64(1), event_name = 'impression' AND target_type = 'post') AS impressions,
	uniqStateIf(user_id, event_name = 'impression' AND target_type = 'post') AS reach,
	uniqStateIf(user_id, event_name = 'impression' AND target_type = 'post') AS reach_all,
  sumIf(toUInt64(1), event_name = 'click' AND target_type = 'post') AS clicks,
  sumIf(toUInt64(1), event_name = 'go to link' AND target_type = 'post') AS go_to_link,
	max(server_timestamp) AS created_at
FROM
	events.raw_events
WHERE
	event_name IN ('share post', 'bookmark post', 'impression', 'share to squad', 'click', 'go to link')
	AND target_id IS NOT NULL
	AND server_timestamp > '2025-09-08 13:53:00'
GROUP BY
	target_id
SETTINGS materialized_views_ignore_errors = 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS api.post_analytics_events_ads_clicks_mv
TO api.post_analytics
AS
SELECT
	c."postId" AS post_id,
	sum(toUInt64(1)) AS clicks_ads,
	max(event_timestamp) AS created_at
FROM
	skadi.ad_clicks sai
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
