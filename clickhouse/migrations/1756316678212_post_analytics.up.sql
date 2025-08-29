-- up

CREATE TABLE IF NOT EXISTS api.post_analytics
(
    post_id String,
    created_at SimpleAggregateFunction(max, DateTime64(3)),
    impressions SimpleAggregateFunction(sum, UInt64),
    reach AggregateFunction(uniq, String),
    profile_views AggregateFunction(uniq, String),
    followers AggregateFunction(uniq, String),
    squad_joins AggregateFunction(uniq, String),
    bookmarks AggregateFunction(uniq, String),
    shares_internal SimpleAggregateFunction(sum, UInt64),
    shares_external SimpleAggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY post_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS api.post_analytics_events_mv
TO api.post_analytics
AS
SELECT
    target_id AS post_id,
    sumIf(toUInt64(1), event_name = 'share post') AS shares_external,
    sumIf(toUInt64(1), event_name = 'share to squad') AS shares_internal,
    uniqStateIf(user_id, event_name = 'bookmark post') AS bookmarks,
    sumIf(toUInt64(1), event_name = 'impression' and target_type = 'post') AS impressions,
    uniqStateIf(user_id, event_name = 'impression' AND target_type = 'post') AS reach,
    max(server_timestamp) AS created_at
FROM events.raw_events
WHERE event_name IN ('share post', 'bookmark post', 'impression', 'share to squad')
AND target_id is not null
AND server_timestamp > '2025-08-25 18:45:00'
GROUP BY target_id
SETTINGS materialized_views_ignore_errors = 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS api.post_analytics_events_referrer_mv
TO api.post_analytics
AS
SELECT
    JSON_VALUE(extra, '$.referrer_target_id') AS post_id,
    uniqStateIf(user_id, event_name = 'profile view') AS profile_views,
    uniqStateIf(user_id, event_name = 'follow') AS followers,
    uniqStateIf(user_id, event_name = 'complete joining squad') AS squad_joins,
    max(server_timestamp) AS created_at
FROM events.raw_events
WHERE event_name IN ('profile view', 'follow', 'complete joining squad')
AND JSON_VALUE(extra, '$.referrer_target_id') is not null
AND JSON_VALUE(extra, '$.referrer_target_type') = 'post'
AND JSON_VALUE(extra, '$.author') = '1'
AND server_timestamp > '2025-08-25 18:45:00'
GROUP BY JSON_VALUE(extra, '$.referrer_target_id')
SETTINGS materialized_views_ignore_errors = 1;

CREATE TABLE IF NOT EXISTS api.post_analytics_history
(
    post_id String,
    created_at SimpleAggregateFunction(max, DateTime64(3)),
    date Date, -- YYYY-MM-DD
    impressions SimpleAggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (date, post_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS api.post_analytics_history_events_daily_mv
TO api.post_analytics_history
AS
SELECT
    target_id                                          AS post_id,
    toDate(server_timestamp)                           AS date,
    sumIf(toUInt64(1), event_name = 'impression'
              AND target_type = 'post')                AS impressions,
    max(server_timestamp)                              AS created_at
FROM events.raw_events
WHERE event_name IN ('impression')
AND target_id is not null
AND "server_timestamp" > '2025-08-25 20:08:00'
GROUP BY date, post_id
SETTINGS materialized_views_ignore_errors = 1;
