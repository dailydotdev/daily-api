-- down

ALTER TABLE api.post_analytics_history
    DROP COLUMN IF EXISTS impressions_ads;

ALTER TABLE api.post_analytics
    DROP COLUMN IF EXISTS reach_all;

ALTER TABLE api.post_analytics
    DROP COLUMN IF EXISTS reach_ads;

ALTER TABLE api.post_analytics
    DROP COLUMN IF EXISTS impressions_ads;
