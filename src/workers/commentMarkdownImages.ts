import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateNewImageHandler } from './generators';

const worker: Worker = {
  subscription: 'api.comment-markdown-images',
  handler: generateNewImageHandler('comment', ContentImageUsedByType.Comment),
};

export default worker;
