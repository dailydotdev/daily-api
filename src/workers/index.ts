import { BaseTypedWorker, Worker } from './worker';
import newView from './newView';
import commentUpvotedRep from './commentUpvotedRep';
import commentUpvoteCanceledRep from './commentUpvoteCanceledRep';
import postScoutMatchedSlack from './postScoutMatchedSlack';
import commentCommentedSlackMessage from './commentCommentedSlackMessage';
import postCommentedSlackMessage from './postCommentedSlackMessage';
import postUpvotedRep from './postUpvotedRep';
import postUpvoteCanceledRep from './postUpvoteCanceledRep';
import postCommentedRedis from './postCommentedRedis';
import postUpvotedRedis from './postUpvotedRedis';
import postBannedRep from './postBannedRep';
import postDeletedCommentsCleanup from './postDeletedCommentsCleanup';
import usernameChanged from './usernameChanged';
import sourceRequestApprovedRep from './sourceRequestApprovedRep';
import updateComments from './updateComments';
import cdc from './cdc/primary';
import cdcNotifications from './cdc/notifications';
import newNotificationRealTime from './newNotificationV2RealTime';
import newNotificationMail from './newNotificationV2Mail';
import newNotificationPush from './newNotificationV2Push';
import { workers as notificationWorkers } from './notifications';
import sourcePrivacyUpdated from './sourcePrivacyUpdated';
import postUpdated from './postUpdated';
import postFreeformImages from './postFreeformImages';
import postEditedFreeformImages from './postEditedFreeformImages';
import deleteCloudinaryImage from './deleteCloudinaryImage';
import bannerAdded from './bannerAdded';
import bannerDeleted from './bannerDeleted';
import {
  postCommentedWorker,
  commentCommentedWorker,
} from './commentMarkdownImages';
import {
  commentEditedWorker,
  commentDeletedWorker,
} from './commentEditedImages';
import experimentAllocated from './experimentAllocated';
import sourceSquadCreatedUserAction from './sourceSquadCreatedUserAction';
import personalizedDigestEmailWorker from '../workers/personalizedDigestEmail';
import deadLetterLog from './digestDeadLetterLog';
import userReadmeImages from './userReadmeImages';
import postDownvotedRep from './postDownvotedRep';
import postDownvoteCanceledRep from './postDownvoteCanceledRep';
import userCreatedPersonalizedDigestSendType from './userCreatedPersonalizedDigestSendType';
import commentDownvotedRep from './commentDownvotedRep';
import commentDownvoteCanceledRep from './commentDownvoteCanceledRep';
import userUpdatedCio from './userUpdatedCio';
import userDeletedCio from './userDeletedCio';
import userStreakUpdatedCio from './userStreakUpdatedCio';
import { vordrPostCommentPrevented } from './vordrPostCommentPrevented';
import { vordrPostPrevented } from './vordrPostPrevented';
import { postAddedSlackChannelSendWorker } from './postAddedSlackChannelSend';
import userCompanyApprovedCio from './userCompanyApprovedCio';
import userUpdatedPlusSubscriptionSquad from './userUpdatedPlusSubscriptionSquad';
import userUpdatedPlusSubscriptionCustomFeed from './userUpdatedPlusSubscriptionCustomFeed';
import { postTranslated } from './postTranslated';
import postDeletedSharedPostCleanup from './postDeletedSharedPostCleanup';
import { transactionBalanceLogWorker } from './transactionBalanceLog';
import { userBoughtCores } from './transactions/userBoughtCores';
import { organizationUserLeft } from './organization/organizationUserLeft';
import { organizationUserRemoved } from './organization/organizationUserRemoved';
import { userGenerateBriefWorker } from './brief/userGenerateBrief';
import { userUpdatedPlusSubscriptionBriefWorker } from './userUpdatedPlusSubscriptionBrief';
import { postAddedSlackChannelSendBriefWorker } from './postAddedSlackChannelSendBrief';
import campaignUpdatedAction from './campaignUpdatedAction';
import campaignUpdatedSlack from './campaignUpdatedSlack';
import { postAnalyticsUpdate } from './postAnalytics/postAnalyticsUpdate';
import { postAuthorReputationEvent } from './postAnalytics/postAuthorReputationEvent';
import { postAuthorCoresEarned } from './postAnalytics/postAuthorCoresEarned';
import { storeCandidateOpportunityMatch } from './opportunity/storeCandidateOpportunityMatch';
import { storeCandidateApplicationScore } from './opportunity/storeCandidateApplicationScore';
import { syncOpportunityRemindersCio } from './opportunity/syncOpportunityRemindersCio';
import { extractCVMarkdown } from './extractCVMarkdown';
import candidateReviewOpportunitySlack from './candidateReviewOpportunitySlack';
import recruiterRejectedCandidateMatchEmail from './recruiterRejectedCandidateMatchEmail';
import { opportunityPreviewResultWorker } from './opportunity/opportunityPreviewResult';
import opportunityInReviewSlack from './opportunityInReviewSlack';
import {
  parseOpportunityFeedbackWorker,
  parseRejectedOpportunityFeedbackWorker,
} from './opportunity/parseOpportunityFeedback';
import { parseOpportunityWorker } from './opportunity/parseOpportunity';
import feedbackClassify from './feedbackClassify';
import feedbackUpdatedSlack from './feedbackUpdatedSlack';

export { Worker } from './worker';

export const workers: Worker[] = [
  bannerAdded,
  bannerDeleted,
  newView,
  postCommentedWorker,
  commentCommentedWorker,
  commentEditedWorker,
  commentDeletedWorker,
  postScoutMatchedSlack,
  commentCommentedSlackMessage,
  postCommentedSlackMessage,
  postCommentedRedis,
  postUpvotedRedis,
  postBannedRep,
  postDeletedCommentsCleanup,
  postDeletedSharedPostCleanup,
  usernameChanged,
  updateComments,
  newNotificationRealTime,
  newNotificationMail,
  newNotificationPush,
  sourcePrivacyUpdated,
  postUpdated,
  postFreeformImages,
  postEditedFreeformImages,
  deleteCloudinaryImage,
  experimentAllocated,
  sourceSquadCreatedUserAction,
  userReadmeImages,
  cdc,
  cdcNotifications,
  userCreatedPersonalizedDigestSendType,
  ...notificationWorkers,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const typedWorkers: BaseTypedWorker<any>[] = [
  sourceRequestApprovedRep,
  commentDownvotedRep,
  commentDownvoteCanceledRep,
  commentUpvotedRep,
  commentUpvoteCanceledRep,
  postUpvotedRep,
  postUpvoteCanceledRep,
  postDownvotedRep,
  postDownvoteCanceledRep,
  userUpdatedCio,
  userDeletedCio,
  userStreakUpdatedCio,
  vordrPostCommentPrevented,
  vordrPostPrevented,
  postAddedSlackChannelSendWorker,
  userCompanyApprovedCio,
  userUpdatedPlusSubscriptionSquad,
  userUpdatedPlusSubscriptionCustomFeed,
  postTranslated,
  transactionBalanceLogWorker,
  userBoughtCores,
  organizationUserLeft,
  organizationUserRemoved,
  userGenerateBriefWorker,
  userUpdatedPlusSubscriptionBriefWorker,
  postAddedSlackChannelSendBriefWorker,
  postAnalyticsUpdate,
  postAuthorReputationEvent,
  postAuthorCoresEarned,
  campaignUpdatedAction,
  campaignUpdatedSlack,
  storeCandidateOpportunityMatch,
  storeCandidateApplicationScore,
  syncOpportunityRemindersCio,
  extractCVMarkdown,
  candidateReviewOpportunitySlack,
  recruiterRejectedCandidateMatchEmail,
  opportunityPreviewResultWorker,
  opportunityInReviewSlack,
  parseOpportunityFeedbackWorker,
  parseRejectedOpportunityFeedbackWorker,
  parseOpportunityWorker,
  feedbackClassify,
  feedbackUpdatedSlack,
];

export const personalizedDigestWorkers: Worker[] = [
  personalizedDigestEmailWorker,
  deadLetterLog,
];
