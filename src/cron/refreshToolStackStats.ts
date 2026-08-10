import { Cron } from './cron';
import { ToolStackStats } from '../entity/ToolStackStats';

const cron: Cron = {
  name: 'refresh-tool-stack-stats',
  handler: async (con) => {
    await con.query(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY ${con.getRepository(ToolStackStats).metadata.tableName}`,
    );
  },
};

export default cron;
