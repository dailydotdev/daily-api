import { Connection } from 'typeorm';
import { View, TagSegment, PostKeyword } from '../entity';
import { messageToJson, Worker } from './worker';

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
  const rows: SegmentRow[] = await con
    .createQueryBuilder()
    .select('ts.segment', 'segment')
    .from(View, 'v')
    .innerJoin(PostKeyword, 'pk', 'v."postId" = pk."postId"')
    .innerJoin(TagSegment, 'ts', 'ts.tag = pk.keyword')
    .where('extract(epoch from now() - v."timestamp")/86400 < 180')
    .andWhere('v."userId" = :userId', { userId })
    .groupBy('ts.segment')
    .orderBy('count(*)', 'DESC')
    .getRawMany();
  if (rows.length) {
    return (
      rows.find((row) => row.segment === 'kubernetes')?.segment ??
      rows[0].segment
    );
  }
  return null;
};

const worker: Worker = {
  subscription: 'daily-api-v2',
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
          messageId: message.messageId,
          segment,
        },
        'find successfully segment for user',
      );
    } catch (err) {
      logger.error(
        {
          userId: data.userId,
          messageId: message.messageId,
          err,
        },
        'failed to find segment for user',
      );
      throw err;
    }
  },
};

export default worker;
