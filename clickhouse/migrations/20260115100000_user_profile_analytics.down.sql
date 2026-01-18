-- Drop MVs first (they depend on tables)
DROP VIEW IF EXISTS api.user_profile_analytics_history_mv;
DROP VIEW IF EXISTS api.user_profile_analytics_mv;

-- Drop tables
DROP TABLE IF EXISTS api.user_profile_analytics_history;
DROP TABLE IF EXISTS api.user_profile_analytics;
