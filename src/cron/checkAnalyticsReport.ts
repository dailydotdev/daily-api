import { Post } from '../entity';
import { Cron } from './cron';
import { notifySendAnalyticsReport } from '../common';

interface Row {
  id: string;
}

const cron: Cron = {
  name: 'checkAnalyticsReport',
  handler: async (con) => {
    const rows = await con
      .createQueryBuilder()
      .select('id')
      .from(Post, 'post')
      .where(`"createdAt" <= now() - interval '20 hour'`)
      .andWhere('"sentAnalyticsReport" = false')
      .andWhere('"authorId" is not null')
      .getRawMany<Row>();
    await Promise.all(
      rows.map((data) => notifySendAnalyticsReport(console, data.id)),
    );
  },
};

export default cron;
