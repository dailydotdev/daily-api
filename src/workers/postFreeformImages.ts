import {
  ContentImageUsedByType,
  FreeformPost,
  Post,
  updateUsedImagesInContent,
} from '../entity';
import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.post-freeform-images',
  handler: async (message, con): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;
    const freeform = post as unknown as FreeformPost;
    if (!freeform?.contentHtml) {
      return;
    }
    await updateUsedImagesInContent(con, ContentImageUsedByType.Post, freeform);
  },
};

export default worker;
