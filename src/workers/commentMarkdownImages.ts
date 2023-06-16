import {
  Comment,
  ContentImageUsedByType,
  updateUsedImagesInContent,
} from '../entity';
import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';

interface Data {
  comment: ChangeObject<Comment>;
}

const worker: Worker = {
  subscription: 'api.comment-markdown-images',
  handler: async (message, con): Promise<void> => {
    const data: Data = messageToJson(message);
    const { comment } = data;
    if (!comment?.contentHtml) {
      return;
    }
    await updateUsedImagesInContent(
      con,
      ContentImageUsedByType.Comment,
      comment,
    );
  },
};

export default worker;
