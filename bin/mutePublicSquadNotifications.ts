import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { Source, SourceMember } from '../src/entity';
import {
  NotificationPreferenceStatus,
  NotificationType,
  saveNotificationPreference,
} from '../src/notifications/common';

interface SourceMemberQueue {
  userId: string;
  sourceId: string;
}

const QUEUE_CONCURRENCY = 100;

(async () => {
  const con = await createOrGetConnection();
  const stream = await con
    .getRepository(SourceMember)
    .createQueryBuilder('sm')
    .select('sm."userId"')
    .addSelect('sm."sourceId"')
    .innerJoin(Source, 's', 's.id = sm."sourceId"')
    .where('s.private IS FALSE')
    .andWhere(
      `
      s.id NOT IN
        (
            SELECT  np."sourceId"
            FROM    notification_preference np
            WHERE   np."sourceId" = s.id
            AND     np."referenceId" = s.id
            AND     np."userId" = sm."userId"
            AND     np."notificationType" = 'squad_post_added'
            AND     np.status = 'muted'
        )
    `,
    )
    .stream();

  let insertCount = 0;
  const insertQueue = fastq.promise(
    async ({ userId, sourceId }: SourceMemberQueue) => {
      await saveNotificationPreference(
        con,
        userId,
        sourceId,
        NotificationType.SquadPostAdded,
        NotificationPreferenceStatus.Muted,
      );
      insertCount += 1;
    },
    QUEUE_CONCURRENCY,
  );

  stream.on('data', insertQueue.push);

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  await insertQueue.drained();
  console.log('insertion finished with a total of: ', insertCount);
  process.exit();
})();
