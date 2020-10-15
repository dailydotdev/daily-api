import { Post } from '../entity';
import { Cron } from './cron';
import { notifySendAnalyticsReport } from '../common';

interface Row {
  id: string;
}

const cron: Cron = {
  name: 'checkAnalyticsReport',
  handler: async (con) => {
    const resStream = await con
      .createQueryBuilder()
      .select('id')
      .from(Post, 'post')
      .where(`"createdAt" <= now() - interval '20 hour'`)
      .andWhere('"sentAnalyticsReport" = false')
      .andWhere('"authorId" is not null')
      .stream();
    resStream.on('data', async (data: Row) => {
      await notifySendAnalyticsReport(console, data.id);
    });
    return new Promise((resolve, reject) => {
      resStream.on('error', reject);
      resStream.on('end', resolve);
    });
  },
};

export default cron;
