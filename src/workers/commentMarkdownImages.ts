import { ContentImageUsedByType } from '../entity';
import { messageToJson, Worker } from './worker';
import { generateNewImagesHandler } from './generators';

export const postCommentedWorker: Worker = {
  subscription: 'api.post-commented-images',
  handler: async (message, con): Promise<void> => {
    const data: { commentId: string; contentHtml: string } =
      messageToJson(message);
    await generateNewImagesHandler(
      { id: data.commentId, contentHtml: data.contentHtml },
      ContentImageUsedByType.Comment,
      con,
    );
  },
};

export const commentCommentedWorker: Worker = {
  subscription: 'api.comment-commented-images',
  handler: async (message, con): Promise<void> => {
    const data: { childCommentId: string; contentHtml: string } =
      messageToJson(message);
    await generateNewImagesHandler(
      { id: data.childCommentId, contentHtml: data.contentHtml },
      ContentImageUsedByType.Comment,
      con,
    );
  },
};
