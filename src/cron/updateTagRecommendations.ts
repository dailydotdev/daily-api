import { Cron } from './cron';
import { TagRecommendation } from '../entity/TagRecommendation';

const cron: Cron = {
  name: 'update-tag-recommendations',
  handler: async (con, logger) => {
    const materializedViewName =
      con.getRepository(TagRecommendation).metadata.tableName;

    try {
      await con.query(`REFRESH MATERIALIZED VIEW ${materializedViewName}`);

      logger.info({}, 'tag recommendations updated');
    } catch (err) {
      logger.error({ err }, 'failed to update tag recommendations');
    }
  },
};

export default cron;
