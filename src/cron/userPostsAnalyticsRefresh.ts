import { Cron } from './cron';

export const userPostsAnalyticsRefreshCron: Cron = {
  name: 'user-posts-analytics-refresh',
  handler: async (con, logger) => {
    await con.query(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY user_posts_analytics',
    );

    logger.info('refreshed user posts analytics materialized view');
  },
};
