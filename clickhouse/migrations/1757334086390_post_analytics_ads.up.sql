-- up

ALTER TABLE api.post_analytics
    ADD COLUMN IF NOT EXISTS impressions_ads SimpleAggregateFunction(sum, UInt64) DEFAULT 0;

ALTER TABLE api.post_analytics
    ADD COLUMN IF NOT EXISTS reach_ads AggregateFunction(uniq, String);

ALTER TABLE api.post_analytics
    ADD COLUMN IF NOT EXISTS reach_all AggregateFunction(uniq, String);

ALTER TABLE api.post_analytics_history
    ADD COLUMN IF NOT EXISTS impressions_ads SimpleAggregateFunction(sum, UInt64) DEFAULT 0;
