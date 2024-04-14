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
import updateMailingList from './updateMailingList';
import deleteUserFromMailingList from './deleteUserFromMailingList';
import newNotificationRealTime from './newNotificationV2RealTime';
import newNotificationMail from './newNotificationV2Mail';
import newNotificationPush from './newNotificationV2Push';
import addToMailingList from './addToMailingList';
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
import sourceSquadCreatedOwnerMailing from './sourceSquadCreatedOwnerMailing';
import personalizedDigestEmailWorker from '../workers/personalizedDigestEmail';
import deadLetterLog from './digestDeadLetterLog';
import userReadmeImages from './userReadmeImages';
import postDownvotedRep from './postDownvotedRep';
import postDownvoteCanceledRep from './postDownvoteCanceledRep';
import userCreatedPersonalizedDigestSendType from './userCreatedPersonalizedDigestSendType';
import commentDownvotedRep from './commentDownvotedRep';
import commentDownvoteCanceledRep from './commentDownvoteCanceledRep';

export { Worker } from './worker';

export const workers: Worker[] = [
  bannerAdded,
  bannerDeleted,
  newView,
  updateMailingList,
  deleteUserFromMailingList,
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
  usernameChanged,
  updateComments,
  newNotificationRealTime,
  newNotificationMail,
  newNotificationPush,
  addToMailingList,
  sourcePrivacyUpdated,
  postUpdated,
  postFreeformImages,
  postEditedFreeformImages,
  deleteCloudinaryImage,
  experimentAllocated,
  sourceSquadCreatedUserAction,
  sourceSquadCreatedOwnerMailing,
  userReadmeImages,
  cdc,
  cdcNotifications,
  userCreatedPersonalizedDigestSendType,
  ...notificationWorkers,
];

export const typedWorkers: BaseTypedWorker<unknown>[] = [
  sourceRequestApprovedRep,
  commentDownvotedRep,
  commentDownvoteCanceledRep,
  commentUpvotedRep,
  commentUpvoteCanceledRep,
  postUpvotedRep,
  postUpvoteCanceledRep,
  postDownvotedRep,
  postDownvoteCanceledRep,
];

export const personalizedDigestWorkers: Worker[] = [
  personalizedDigestEmailWorker,
  deadLetterLog,
];
