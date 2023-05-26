import cloudinary from 'cloudinary';
import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { ContentImage } from '../entity';

interface Data {
  contentImage: ChangeObject<ContentImage>;
}

const worker: Worker = {
  subscription: 'api.delete-cloudinary-image',
  handler: async (message, _, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { contentImage } = data;
    await new Promise<void>((resolve, reject) => {
      cloudinary.v2.uploader.destroy(contentImage.serviceId, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
    logger.info({ data: contentImage }, 'deleted zombie image');
  },
};

export default worker;
