CREATE TABLE IF NOT EXISTS api.user_profile_analytics
(
    profile_id String,
    created_at SimpleAggregateFunction(max, DateTime64(3)),
    unique_visitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY profile_id;

CREATE TABLE IF NOT EXISTS api.user_profile_analytics_history
(
    profile_id String,
    date Date,
    created_at SimpleAggregateFunction(max, DateTime64(3)),
    unique_visitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (date, profile_id);

-- MV for main aggregation (all-time totals)
CREATE MATERIALIZED VIEW IF NOT EXISTS api.user_profile_analytics_mv
TO api.user_profile_analytics
AS
SELECT
    target_id AS profile_id,
    uniqStateIf(user_id, event_name = 'profile view') AS unique_visitors,
    max(server_timestamp) AS created_at
FROM events.raw_events
WHERE event_name IN ('profile view')
AND target_id IS NOT NULL
AND server_timestamp > '2026-01-23 11:04:00'
GROUP BY target_id
SETTINGS materialized_views_ignore_errors = 1;

-- MV for daily history
CREATE MATERIALIZED VIEW IF NOT EXISTS api.user_profile_analytics_history_mv
TO api.user_profile_analytics_history
AS
SELECT
    target_id AS profile_id,
    toDate(server_timestamp) AS date,
    uniqStateIf(user_id, event_name = 'profile view') AS unique_visitors,
    max(server_timestamp) AS created_at
FROM events.raw_events
WHERE event_name IN ('profile view')
AND target_id IS NOT NULL
AND server_timestamp > '2026-01-23 11:04:00'
GROUP BY date, target_id
SETTINGS materialized_views_ignore_errors = 1;
