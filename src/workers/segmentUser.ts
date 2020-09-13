import { Connection } from 'typeorm';
import { View, TagSegment, PostTag } from '../entity';
import { envBasedName, messageToJson, Worker } from './worker';
import { PubSub } from '@google-cloud/pubsub';

interface Data {
  userId: string;
}

interface SegmentRow {
  segment: string;
}

const findSegment = async (
  userId: string,
  con: Connection,
): Promise<string | null> => {
  const res: SegmentRow = await con
    .createQueryBuilder()
    .select('ts.segment', 'segment')
    .from(View, 'v')
    .innerJoin(PostTag, 'pt', 'v."postId" = pt."postId"')
    .innerJoin(TagSegment, 'ts', 'ts.tag = pt.tag')
    .where('extract(epoch from now() - v."timestamp")/86400 < 30')
    .andWhere('v."userId" = :userId', { userId })
    .groupBy('ts.segment')
    .orderBy('count(*)', 'DESC')
    .getRawOne();
  return res?.segment;
};

const worker: Worker = {
  topic: 'find-segment',
  subscription: envBasedName('daily-api-v2'),
  handler: async (message, con, logger, pubsub): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const segment = await findSegment(data.userId, con);
      if (segment) {
        await pubsub.topic('segment-found').publishJSON({
          userId: data.userId,
          segment,
        });
      }
      logger.info(
        {
          userId: data.userId,
          messageId: message.id,
          segment,
        },
        'find successfully segment for user',
      );
      message.ack();
    } catch (err) {
      logger.error(
        {
          userId: data.userId,
          messageId: message.id,
          err,
        },
        'failed to find segment for user',
      );
      message.nack();
    }
  },
};

export default worker;
