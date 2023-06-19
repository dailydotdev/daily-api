import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateNewImagesHandler } from './generators';

export const postCommentedWorker: Worker = {
  subscription: 'api.post-commented-images',
  handler: generateNewImagesHandler('comment', ContentImageUsedByType.Comment),
};

export const commentCommentedWorker: Worker = {
  subscription: 'api.comment-commented-images',
  handler: generateNewImagesHandler('comment', ContentImageUsedByType.Comment),
};
