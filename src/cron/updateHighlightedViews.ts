import { Cron } from './cron';
import { PopularPost } from '../entity/PopularPost';
import { PopularSource } from '../entity/PopularSource';
import { PopularTag } from '../entity/PopularTag';
import { PopularVideoSource } from '../entity/PopularVideoSource';
import { TrendingPost } from '../entity/TrendingPost';
import { TrendingSource } from '../entity/TrendingSource';
import { TrendingTag } from '../entity/TrendingTag';
import { PopularVideoPost } from '../entity/PopularVideoPost';
import { UserStats } from '../entity';
import { TrendingUserPost } from '../entity/TrendingUserPost';
import { TrendingUserSource } from '../entity/TrendingUserSource';
import { PopularUserPost } from '../entity/PopularUserPost';
import { PopularUserSource } from '../entity/PopularUserSource';

const cron: Cron = {
  name: 'update-highlighted-views',
  handler: async (con, logger) => {
    const viewsToRefresh = [
      TrendingPost,
      TrendingSource,
      TrendingUserPost,
      TrendingUserSource,
      TrendingTag,
      PopularPost,
      PopularSource,
      PopularUserPost,
      PopularUserSource,
      PopularTag,
      PopularVideoPost,
      PopularVideoSource,
      UserStats,
    ];

    try {
      await con.transaction(async (manager) => {
        for (const viewToRefresh of viewsToRefresh) {
          await manager.query(
            `REFRESH MATERIALIZED VIEW ${con.getRepository(viewToRefresh).metadata.tableName}`,
          );
        }
      });

      logger.info('highlighted views updated');
    } catch (err) {
      logger.error({ err }, 'failed to update highlighted views');
    }
  },
};

export default cron;
