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
import { PopularHotTake } from '../entity/PopularHotTake';

const cron: Cron = {
  name: 'update-highlighted-views',
  handler: async (con, logger) => {
    const viewsToRefresh = [
      TrendingPost,
      TrendingSource,
      TrendingTag,
      PopularPost,
      PopularSource,
      PopularTag,
      PopularVideoPost,
      PopularVideoSource,
      UserStats,
      PopularHotTake,
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
