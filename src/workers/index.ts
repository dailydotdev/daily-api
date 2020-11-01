import { Worker } from './worker';
import newView from './newView';
import newPost from './newPost';
import segmentUser from './segmentUser';
import newUser from './newUser';
import updateUser from './updateUser';
import commentUpvoted from './commentUpvoted';
import commentCommented from './commentCommented';
import commentUpvotedRep from './commentUpvotedRep';
import commentFeaturedRep from './commentFeaturedRep';
import commentUpvoteCanceledRep from './commentUpvoteCanceledRep';
import commentCommentedThread from './commentCommentedThread';
import commentFeaturedMail from './commentFeaturedMail';
import postAuthorMatchedMail from './postAuthorMatchedMail';
import commentCommentedAuthor from './commentCommentedAuthor';
import postCommentedAuthor from './postCommentedAuthor';
import postUpvotedRep from './postUpvotedRep';
import postUpvoteCanceledRep from './postUpvoteCanceledRep';
import sendAnalyticsReportMail from './sendAnalyticsReportMail';
import postCommentedAuthorTweet from './postCommentedAuthorTweet';

export { Worker } from './worker';

export const workers: Worker[] = [
  newView,
  newPost,
  segmentUser,
  newUser,
  updateUser,
  commentUpvoted,
  commentCommented,
  commentUpvotedRep,
  commentFeaturedRep,
  commentUpvoteCanceledRep,
  commentCommentedThread,
  commentFeaturedMail,
  postAuthorMatchedMail,
  commentCommentedAuthor,
  postCommentedAuthor,
  postUpvotedRep,
  postUpvoteCanceledRep,
  sendAnalyticsReportMail,
  postCommentedAuthorTweet,
];
