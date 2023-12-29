import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateEditImagesHandler } from './generators';

const worker: Worker = {
  subscription: 'api.user-readme-images',
  handler: generateEditImagesHandler(
    'user',
    ContentImageUsedByType.User,
    {},
    'readmeHtml',
  ),
};

export default worker;
