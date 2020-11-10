import { PubSub } from '@google-cloud/pubsub';
import { View } from '../entity';
import { Cron } from './cron';

interface Row {
  userId: string;
}

const cron: Cron = {
  name: 'segment-users',
  handler: async (con, logger) => {
    const pubsub = new PubSub();
    const topic = pubsub.topic('find-segment');

    const resStream = await con
      .createQueryBuilder()
      .select('"userId"')
      .from(View, 'v')
      .where('extract(epoch from now() - "timestamp")/86400 < 30')
      .groupBy('"userId"')
      .stream();
    resStream.on('data', (data: Row) => {
      topic
        .publishJSON(data)
        .catch((err) => logger.error('failed to dispatch find-segment', err));
    });
    return new Promise((resolve, reject) => {
      resStream.on('error', reject);
      resStream.on('end', resolve);
    });
  },
};

export default cron;
