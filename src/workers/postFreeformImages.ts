import { ContentImageUsedByType, FreeformPost } from '../entity';
import { messageToJson, Worker } from './worker';
import { generateNewImagesHandler } from './generators';
import { ChangeObject } from '../types';

const worker: Worker = {
  subscription: 'api.post-freeform-images',
  handler: async (message, con): Promise<void> => {
    const data: {
      post: ChangeObject<FreeformPost>;
    } = messageToJson(message);
    await generateNewImagesHandler(
      { id: data.post?.id, contentHtml: data.post?.contentHtml },
      ContentImageUsedByType.Post,
      con,
    );
  },
};

export default worker;
