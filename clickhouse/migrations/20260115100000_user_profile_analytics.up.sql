CREATE TABLE api.user_profile_analytics
(
    user_id String,
    created_at SimpleAggregateFunction(max, DateTime64(3)),
    unique_visitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY user_id;

CREATE TABLE api.user_profile_analytics_history
(
    user_id String,
    date Date,
    created_at SimpleAggregateFunction(max, DateTime64(3)),
    unique_visitors AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (date, user_id);

-- MV for main aggregation (all-time totals)
CREATE MATERIALIZED VIEW api.user_profile_analytics_mv
TO api.user_profile_analytics
AS
SELECT
    target_id AS user_id,
    uniqState(user_id) AS unique_visitors,
    max(server_timestamp) AS created_at
FROM events.raw_events
WHERE event_name = 'profile view'
AND target_id IS NOT NULL
GROUP BY target_id;

-- MV for daily history
CREATE MATERIALIZED VIEW api.user_profile_analytics_history_mv
TO api.user_profile_analytics_history
AS
SELECT
    target_id AS user_id,
    toDate(server_timestamp) AS date,
    uniqState(user_id) AS unique_visitors,
    max(server_timestamp) AS created_at
FROM events.raw_events
WHERE event_name = 'profile view'
AND target_id IS NOT NULL
GROUP BY date, target_id;
