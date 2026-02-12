import { messageToJson, TypedNotificationWorker, Worker } from '../worker';
import { generateAndStoreNotificationsV2 } from '../../notifications';
import { communityPicksFailed } from './communityPicksFailed';
import { articleNewCommentPostCommented } from './articleNewCommentPostCommented';
import { articleUpvoteMilestone } from './articleUpvoteMilestone';
import { articleReportApproved } from './articleReportApproved';
import { articleAnalytics } from './articleAnalytics';
import { sourceRequest } from './sourceRequest';
import { commentMention } from './commentMention';
import { commentReply } from './commentReply';
import { commentUpvoteMilestone } from './commentUpvoteMilestone';
import { postAdded } from './postAdded';
import { squadMemberJoined } from './squadMemberJoined';
import { sourceMemberRoleChanged } from './sourceMemberRoleChanged';
import { squadPublicRequestNotification } from './squadPublicRequestNotification';
import { TypeOrmError, TypeORMQueryFailedError } from '../../errors';
import { postMention } from './postMention';
import { collectionUpdated } from './collectionUpdated';
import { devCardUnlocked } from './devCardUnlocked';
import postBookmarkReminder from './postBookmarkReminder';
import userStreakResetNotification from './userStreakResetNotification';
import userGiftedPlusNotification from './userGiftedPlusNotification';
import squadFeaturedUpdated from './squadFeaturedUpdated';
import sourcePostModerationSubmittedNotification from './sourcePostModerationSubmittedNotification';
import sourcePostModerationApprovedNotification from './sourcePostModerationApprovedNotification';
import sourcePostModerationRejectedNotification from './sourcePostModerationRejectedNotification';
import { postAddedUserNotification } from './postAddedUserNotification';
import { userTopReaderAdded } from './userTopReaderAdded';
import { userReceivedAward } from '../transactions/userReceivedAward';
import { organizationUserJoined } from '../organization/organizationUserJoined';
import campaignUpdatedAction from './campaignUpdatedAction';
import { userBriefReadyNotification } from './userBriefReadyNotification';
import { userFollowNotification } from './userFollowNotification';
import { candidateOpportunityMatchNotification } from './candidateOpportunityMatchNotification';
import { campaignPostAnalyticsNotification } from './campaignPostAnalyticsNotification';
import { pollResultAuthorNotification } from './pollResultAuthorNotification';
import { pollResultNotification } from './pollResultNotification';
import { articleNewCommentCommentCommented } from './articleNewCommentCommentCommented';
import { warmIntroNotification } from './warmIntroNotification';
import { parseCVProfileWorker } from '../opportunity/parseCVProfile';
import { recruiterNewCandidateNotification } from './recruiterNewCandidateNotification';
import { recruiterOpportunityLiveNotification } from './recruiterOpportunityLiveNotification';
import { experienceCompanyEnrichedNotification } from './experienceCompanyEnrichedNotification';
import { recruiterExternalPaymentNotification } from './recruiterExternalPaymentNotification';
import { reMatchedOpportunityNotification } from './reMatchedOpportunityNotification';
import { achievementUnlockedNotification } from './achievementUnlockedNotification';

export function notificationWorkerToWorker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worker: TypedNotificationWorker<any>,
): Worker {
  return {
    ...worker,
    handler: async (message, con, logger) => {
      const parsedMessage = worker.parseMessage
        ? worker.parseMessage(message)
        : messageToJson(message);
      const args = await worker.handler(parsedMessage, con, logger);

      if (!args) {
        return;
      }
      try {
        await con.transaction(async (entityManager) => {
          await generateAndStoreNotificationsV2(entityManager, args);
        });
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;
        if (err?.code === TypeOrmError.NULL_VIOLATION) {
          logger.error(
            { data: parsedMessage, err },
            'null violation when creating a notification',
          );
          return;
        }
        if (
          err?.code === TypeOrmError.FOREIGN_KEY &&
          err?.constraint === TypeOrmError.USER_CONSTRAINT
        ) {
          logger.error(
            { data: parsedMessage, err },
            'user constraint failed when creating a notification',
          );
          return;
        }
        throw err;
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notificationWorkers: TypedNotificationWorker<any>[] = [
  communityPicksFailed,
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
  squadMemberJoined,
  sourceMemberRoleChanged,
  squadPublicRequestNotification,
  collectionUpdated,
  devCardUnlocked,
  postBookmarkReminder,
  userStreakResetNotification,
  squadFeaturedUpdated,
  postAddedUserNotification,
  sourcePostModerationSubmittedNotification,
  sourcePostModerationApprovedNotification,
  sourcePostModerationRejectedNotification,
  userTopReaderAdded,
  userGiftedPlusNotification,
  userReceivedAward,
  organizationUserJoined,
  campaignUpdatedAction,
  userBriefReadyNotification,
  userFollowNotification,
  candidateOpportunityMatchNotification,
  campaignPostAnalyticsNotification,
  pollResultAuthorNotification,
  pollResultNotification,
  warmIntroNotification,
  parseCVProfileWorker,
  recruiterNewCandidateNotification,
  recruiterOpportunityLiveNotification,
  experienceCompanyEnrichedNotification,
  recruiterExternalPaymentNotification,
  reMatchedOpportunityNotification,
  achievementUnlockedNotification,
];

export const workers = [...notificationWorkers.map(notificationWorkerToWorker)];
