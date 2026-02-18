import { Cron } from './cron';

export const squadPostsAnalyticsRefreshCron: Cron = {
  name: 'squad-posts-analytics-refresh',
  handler: async (con) => {
    await con.query(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY squad_posts_analytics',
    );
  },
};
