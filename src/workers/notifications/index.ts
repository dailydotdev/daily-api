import { NotificationWorker } from './worker';
import { Worker } from '../worker';
import {
  generateNotification,
  storeNotificationBundle,
} from '../../notifications';
import communityPicksFailed from './communityPicksFailed';
import communityPicksSucceeded from './communityPicksSucceeded';
import communityPicksGranted from './communityPicksGranted';
import articlePicked from './articlePicked';
import articleNewCommentPostCommented from './articleNewCommentPostCommented';
import articleNewCommentCommentCommented from './articleNewCommentCommentCommented';
import articleUpvoteMilestone from './articleUpvoteMilestone';
import articleReportApproved from './articleReportApproved';
import articleAnalytics from './articleAnalytics';
import sourceRequest from './sourceRequest';
import commentMention from './commentMention';
import commentReply from './commentReply';
import commentUpvoteMilestone from './commentUpvoteMilestone';

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
      await con.transaction((entityManager) =>
        storeNotificationBundle(entityManager, bundles),
      );
    },
  };
}

const notificationWorkers: NotificationWorker[] = [
  communityPicksFailed,
  communityPicksSucceeded,
  communityPicksGranted,
  articlePicked,
  articleNewCommentPostCommented,
  articleNewCommentCommentCommented,
  articleUpvoteMilestone,
  articleReportApproved,
  articleAnalytics,
  sourceRequest,
  commentMention,
  commentReply,
  commentUpvoteMilestone,
];

export const workers = notificationWorkers.map(notificationWorkerToWorker);
