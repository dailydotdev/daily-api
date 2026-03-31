import { Cron } from './cron';
import { SourceSimilarityView } from '../entity/SourceSimilarityView';
import { SourceTagView } from '../entity/SourceTagView';
import { TagRecommendation } from '../entity/TagRecommendation';
import { UserSimilarityView } from '../entity/user/UserSimilarityView';
import { UserTagView } from '../entity/user/UserTagView';

const cron: Cron = {
  name: 'update-tag-materialized-views',
  handler: async (con) => {
    const viewsToRefresh = [
      SourceTagView,
      UserTagView,
      SourceSimilarityView,
      UserSimilarityView,
      TagRecommendation,
    ];

    for (const view of viewsToRefresh) {
      await con.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${con.getRepository(view).metadata.tableName}`,
      );
    }
  },
};

export default cron;
