import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateNewImagesHandler } from './generators';

const worker: Worker = {
  subscription: 'api.post-freeform-images',
  handler: generateNewImagesHandler('post', ContentImageUsedByType.Post),
};

export default worker;
