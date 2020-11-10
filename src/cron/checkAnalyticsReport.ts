import { Post } from '../entity';
import { Cron } from './cron';
import { notifySendAnalyticsReport } from '../common';

interface Row {
  id: string;
}

const cron: Cron = {
  name: 'check-analytics-report',
  handler: async (con, logger) => {
    const rows = await con
      .createQueryBuilder()
      .select('id')
      .from(Post, 'post')
      .where(`"createdAt" <= now() - interval '20 hour'`)
      .andWhere('"sentAnalyticsReport" = false')
      .andWhere('"authorId" is not null')
      .getRawMany<Row>();
    await Promise.all(
      rows.map((data) => notifySendAnalyticsReport(logger, data.id)),
    );
  },
};

export default cron;
