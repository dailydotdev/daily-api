-- down

ALTER TABLE api.post_analytics_events_mv
MODIFY QUERY
SELECT
	target_id AS post_id,
	sumIf(toUInt64(1), event_name = 'share post') AS shares_external,
	sumIf(toUInt64(1), event_name = 'share to squad') AS shares_internal,
	uniqStateIf(user_id, event_name = 'bookmark post') AS bookmarks,
	sumIf(toUInt64(1), event_name = 'impression' AND target_type = 'post') AS impressions,
	uniqStateIf(user_id, event_name = 'impression' AND target_type = 'post') AS reach,
	max(server_timestamp) AS created_at
FROM
	events.raw_events
WHERE
	event_name IN ('share post', 'bookmark post', 'impression', 'share to squad')
	AND target_id IS NOT NULL
	AND server_timestamp > '2025-09-08 13:27:00'
GROUP BY
	target_id
SETTINGS materialized_views_ignore_errors = 1;
