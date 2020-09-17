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
];
