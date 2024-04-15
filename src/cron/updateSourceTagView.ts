import { Cron } from './cron';
import { SourceTagView } from '../entity/SourceTagView';

const cron: Cron = {
  name: 'update-source-tag-view',
  handler: async (con, logger) => {
    const materializedViewName =
      con.getRepository(SourceTagView).metadata.tableName;

    try {
      await con.query(`REFRESH MATERIALIZED VIEW ${materializedViewName}`);

      logger.info({}, 'source tag view updated');
    } catch (err) {
      logger.error({ err }, 'failed to update source tag view');
    }
  },
};

export default cron;
