import { FreeformPost, Post, ContentImage } from '../entity';
import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { parse } from 'node-html-parser';
import { In } from 'typeorm';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.freeform-images',
  handler: async (message, con): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;
    const html = (post as unknown as FreeformPost)?.contentHtml;
    if (!html) {
      return;
    }
    const root = parse(html);
    const images = root.querySelectorAll('img');
    const urls = images.map((img) => img.getAttribute('src'));
    await con
      .getRepository(ContentImage)
      .update({ url: In(urls) }, { shouldDelete: false });
  },
};

export default worker;
