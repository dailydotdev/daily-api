import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateEditImagesHandler } from './generators';

const worker: Worker = {
  subscription: 'api.post-edited-freeform-images',
  handler: generateEditImagesHandler('post', ContentImageUsedByType.Post),
};

export default worker;
