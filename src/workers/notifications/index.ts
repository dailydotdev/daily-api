import { NotificationWorker } from './worker';
import { messageToJson, Worker } from '../worker';
import {
  generateNotification,
  storeNotificationBundle,
} from '../../notifications';
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
import commentDeleted from './commentDeleted';
import postDeleted from './postDeleted';

function notificationWorkerToWorker(worker: NotificationWorker): Worker {
  return {
    ...worker,
    handler: async (message, con, logger) => {
      const args = await worker.handler(message, con, logger);
      if (!args) {
        return;
      }
      const bundles = args.map(({ type, ctx }) =>
        generateNotification(type, ctx),
      );
      try {
        await con.transaction((entityManager) =>
          storeNotificationBundle(entityManager, bundles),
        );
      } catch (err) {
        if (err?.code === TypeOrmError.NULL_VIOLATION) {
          logger.warn(
            { data: messageToJson(message) },
            'null violation when creating a notification',
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
];

export const workers = [
  ...notificationWorkers.map(notificationWorkerToWorker),
  // Regular workers under notification scope
  commentDeleted,
  postDeleted,
];
