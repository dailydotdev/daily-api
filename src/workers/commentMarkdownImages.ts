import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateNewImagesHandler } from './generators';

const worker: Worker = {
  subscription: 'api.comment-markdown-images',
  handler: generateNewImagesHandler('comment', ContentImageUsedByType.Comment),
};

export default worker;
