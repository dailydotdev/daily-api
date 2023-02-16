import { Worker } from './worker';
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
import usernameChanged from './usernameChanged';
import usernameChangedUpdateNotifications from './usernameChangedUpdateNotifications';
import sourceRequestApprovedRep from './sourceRequestApprovedRep';
import updateComments from './updateComments';
import cdc from './cdc';
import updateMailingList from './updateMailingList';
import deleteUserFromMailingList from './deleteUserFromMailingList';
import unreadNotificationCount from './unreadNotificationCount';
import newNotificationRealTime from './newNotificationRealTime';
import newNotificationMail from './newNotificationMail';
import newNotificationPush from './newNotificationPush';
import addToMailingList from './addToMailingList';
import squadFeatureAccess from './squadFeatureAccess';
import { workers as notificationWorkers } from './notifications';
import sourcePrivacyUpdated from './sourcePrivacyUpdated';
import postChangelogAdded from './postChangelogAdded';
import clearFeaturesCache from './clearFeaturesCache';

export { Worker } from './worker';

export const workers: Worker[] = [
  newView,
  updateMailingList,
  deleteUserFromMailingList,
  commentUpvotedRep,
  commentUpvoteCanceledRep,
  postScoutMatchedSlack,
  commentCommentedSlackMessage,
  postCommentedSlackMessage,
  postUpvotedRep,
  postUpvoteCanceledRep,
  postCommentedRedis,
  postUpvotedRedis,
  postBannedRep,
  sourceRequestApprovedRep,
  usernameChanged,
  usernameChangedUpdateNotifications,
  updateComments,
  unreadNotificationCount,
  newNotificationRealTime,
  newNotificationMail,
  newNotificationPush,
  squadFeatureAccess,
  addToMailingList,
  sourcePrivacyUpdated,
  postChangelogAdded,
  clearFeaturesCache,
  cdc,
  ...notificationWorkers,
];
