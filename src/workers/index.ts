import { Worker } from './worker';
import newView from './newView';
import newPost from './newPost';
import segmentUser from './segmentUser';
import newUser from './newUser';
import updateUser from './updateUser';

export { Worker } from './worker';

export const workers: Worker[] = [
  newView,
  newPost,
  segmentUser,
  newUser,
  updateUser,
];
