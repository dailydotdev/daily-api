import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateNewImageHandler } from './generators';

const worker: Worker = {
  subscription: 'api.post-freeform-images',
  handler: generateNewImageHandler('post', ContentImageUsedByType.Post),
};

export default worker;
