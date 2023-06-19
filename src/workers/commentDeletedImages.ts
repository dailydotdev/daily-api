import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateEditImagesHandler } from './generators';

const worker: Worker = {
  subscription: 'api.comment-deleted-images',
  handler: generateEditImagesHandler('comment', ContentImageUsedByType.Comment),
};

export default worker;
