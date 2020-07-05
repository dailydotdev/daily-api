import { Worker } from './worker';
import newView from './newView';
import newPost from './newPost';
import segmentUser from './segmentUser';

export { Worker } from './worker';

export const workers: Worker[] = [newView, newPost, segmentUser];
