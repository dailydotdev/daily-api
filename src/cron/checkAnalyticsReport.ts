import { Post } from '../entity';
import { Cron } from './cron';

const cron: Cron = {
  name: 'check-analytics-report',
  handler: async (con) => {
    await con
      .createQueryBuilder()
      .update(Post)
      .set({ sentAnalyticsReport: true })
      .where(`"createdAt" <= now() - interval '20 hour'`)
      .andWhere('"sentAnalyticsReport" = false')
      .andWhere('"authorId" is not null')
      .execute();
  },
};

export default cron;
