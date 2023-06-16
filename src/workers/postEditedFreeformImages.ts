import {
  FreeformPost,
  Post,
  ContentImage,
  ContentImageUsedByType,
  updateUsedImagesInContent,
} from '../entity';
import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.post-edited-freeform-images',
  handler: async (message, con): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;
    const freeform = post as unknown as FreeformPost;
    await con.transaction(async (entityManager) => {
      await entityManager.getRepository(ContentImage).update(
        {
          usedByType: ContentImageUsedByType.Post,
          usedById: post.id,
        },
        { usedByType: null, usedById: null },
      );
      if (!freeform?.contentHtml) {
        return;
      }
      await updateUsedImagesInContent(
        entityManager,
        ContentImageUsedByType.Post,
        freeform,
      );
    });
  },
};

export default worker;
