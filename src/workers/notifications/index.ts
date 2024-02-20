import { NotificationWorker } from './worker';
import { messageToJson, Worker } from '../worker';
import { generateAndStoreNotificationsV2 } from '../../notifications';
import communityPicksFailed from './communityPicksFailed';
import communityPicksGranted from './communityPicksGranted';
import articleNewCommentPostCommented from './articleNewCommentPostCommented';
import articleNewCommentCommentCommented from './articleNewCommentCommentCommented';
import articleUpvoteMilestone from './articleUpvoteMilestone';
import articleReportApproved from './articleReportApproved';
import articleAnalytics from './articleAnalytics';
import sourceRequest from './sourceRequest';
import commentMention from './commentMention';
import commentReply from './commentReply';
import commentUpvoteMilestone from './commentUpvoteMilestone';
import postAdded from './postAdded';
import memberJoinedSource from './squadMemberJoined';
import sourceMemberRoleChanged from './sourceMemberRoleChanged';
import { TypeOrmError } from '../../errors';
import postMention from './postMention';
import { collectionUpdated } from './collectionUpdated';
import devCardUnlocked from './devCardUnlocked';

export function notificationWorkerToWorker(worker: NotificationWorker): Worker {
  return {
    ...worker,
    handler: async (message, con, logger) => {
      const args = await worker.handler(message, con, logger);
      if (!args) {
        return;
      }
      try {
        await con.transaction(async (entityManager) => {
          await generateAndStoreNotificationsV2(entityManager, args);
        });
      } catch (err) {
        if (err?.code === TypeOrmError.NULL_VIOLATION) {
          logger.warn(
            { data: messageToJson(message) },
            'null violation when creating a notification',
          );
          return;
        }
        if (
          err?.code === TypeOrmError.FOREIGN_KEY &&
          err?.constraint === TypeOrmError.USER_CONSTRAINT
        ) {
          logger.warn(
            { data: messageToJson(message) },
            'user constraint failed when creating a notification',
          );
          return;
        }
        throw err;
      }
    },
  };
}

const notificationWorkers: NotificationWorker[] = [
  communityPicksFailed,
  communityPicksGranted,
  articleNewCommentPostCommented,
  articleNewCommentCommentCommented,
  articleUpvoteMilestone,
  articleReportApproved,
  articleAnalytics,
  sourceRequest,
  commentMention,
  postMention,
  commentReply,
  commentUpvoteMilestone,
  postAdded,
  memberJoinedSource,
  sourceMemberRoleChanged,
  collectionUpdated,
  devCardUnlocked,
];

export const workers = [...notificationWorkers.map(notificationWorkerToWorker)];
