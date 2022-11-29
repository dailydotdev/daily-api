import { Worker } from './worker';
import newView from './newView';
import commentUpvoted from './commentUpvoted';
import commentCommented from './commentCommented';
import commentUpvotedRep from './commentUpvotedRep';
import commentUpvoteCanceledRep from './commentUpvoteCanceledRep';
import commentCommentedThread from './commentCommentedThread';
import postAuthorMatchedMail from './postAuthorMatchedMail';
import postScoutMatchedMail from './postScoutMatchedMail';
import communityLinkAccessMail from './communityLinkAccessMail';
import communityLinkRejectedMail from './communityLinkRejectedMail';
import postScoutMatchedSlack from './postScoutMatchedSlack';
import commentCommentedAuthor from './commentCommentedAuthor';
import postCommentedAuthor from './postCommentedAuthor';
import commentCommentedSlackMessage from './commentCommentedSlackMessage';
import postCommentedSlackMessage from './postCommentedSlackMessage';
import postUpvotedRep from './postUpvotedRep';
import postUpvoteCanceledRep from './postUpvoteCanceledRep';
import sendAnalyticsReportMail from './sendAnalyticsReportMail';
// import postCommentedAuthorTweet from './postCommentedAuthorTweet';
import postReachedViewsThresholdTweet from './postReachedViewsThresholdTweet';
import postCommentedRedis from './postCommentedRedis';
import postUpvotedRedis from './postUpvotedRedis';
import postBannedRep from './postBannedRep';
import postBannedEmail from './postBannedEmail';
import sourceRequestApprovedRep from './sourceRequestApprovedRep';
import usernameChanged from './usernameChanged';
import updateComments from './updateComments';
import cdc from './cdc';
import sourceRequestMail from './sourceRequestMail';
import updateMailingList from './updateMailingList';
import deleteUserFromMailingList from './deleteUserFromMailingList';

export { Worker } from './worker';

export const workers: Worker[] = [
  newView,
  updateMailingList,
  deleteUserFromMailingList,
  commentUpvoted,
  commentCommented,
  commentUpvotedRep,
  commentUpvoteCanceledRep,
  commentCommentedThread,
  postAuthorMatchedMail,
  postScoutMatchedMail,
  communityLinkAccessMail,
  communityLinkRejectedMail,
  sourceRequestMail,
  postScoutMatchedSlack,
  commentCommentedAuthor,
  commentCommentedSlackMessage,
  postCommentedSlackMessage,
  postCommentedAuthor,
  postUpvotedRep,
  postUpvoteCanceledRep,
  sendAnalyticsReportMail,
//   postCommentedAuthorTweet,
  postReachedViewsThresholdTweet,
  postCommentedRedis,
  postUpvotedRedis,
  postBannedRep,
  postBannedEmail,
  sourceRequestApprovedRep,
  usernameChanged,
  updateComments,
  cdc,
];
