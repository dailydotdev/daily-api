import { Worker } from './worker';
import newView from './newView';
import commentUpvotedRep from './commentUpvotedRep';
import commentUpvoteCanceledRep from './commentUpvoteCanceledRep';
import postScoutMatchedSlack from './postScoutMatchedSlack';
import commentCommentedSlackMessage from './commentCommentedSlackMessage';
import postCommentedSlackMessage from './postCommentedSlackMessage';
import postUpvotedRep from './postUpvotedRep';
import postUpvoteCanceledRep from './postUpvoteCanceledRep';
// import postCommentedAuthorTweet from './postCommentedAuthorTweet';
// import postReachedViewsThresholdTweet from './postReachedViewsThresholdTweet';
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
import { workers as notificationWorkers } from './notifications';

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
  //   postCommentedAuthorTweet,
  // postReachedViewsThresholdTweet,
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
  cdc,
  ...notificationWorkers,
];
