import { ContentImageUsedByType } from '../entity';
import { Worker } from './worker';
import { generateEditImagesHandler } from './generators';

export const commentEditedWorker: Worker = {
  subscription: 'api.comment-edited-images',
  handler: generateEditImagesHandler('comment', ContentImageUsedByType.Comment),
};

export const commentDeletedWorker: Worker = {
  subscription: 'api.comment-deleted-images',
  handler: generateEditImagesHandler(
    'comment',
    ContentImageUsedByType.Comment,
    { shouldClearOnly: true },
  ),
};
