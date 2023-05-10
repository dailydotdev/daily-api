import cloudinary from 'cloudinary';
import { Readable } from 'stream';
import { SourceType } from '../entity';

export const uploadLogo = (name: string, stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const outStream = cloudinary.v2.uploader.upload_stream(
      {
        public_id: name,
        folder: 'logos',
      },
      (err, callResult) => {
        if (err) {
          return reject(err);
        }
        return resolve(
          `https://res.cloudinary.com/daily-now/image/upload/t_logo,f_auto/v1/${callResult.public_id}`,
        );
      },
    );
    stream.pipe(outStream);
  });

export const uploadFile = (
  name: string,
  preset: string,
  stream: Readable,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const outStream = cloudinary.v2.uploader.upload_stream(
      {
        public_id: name,
        upload_preset: preset,
      },
      (err, callResult) => {
        if (err) {
          return reject(err);
        }

        return resolve(callResult.secure_url);
      },
    );
    stream.pipe(outStream);
  });

export const uploadDevCardBackground = (name: string, stream: Readable) =>
  uploadFile(name, 'devcard', stream);

export const uploadSquadImage = (name: string, stream: Readable) =>
  uploadFile(name, SourceType.Squad, stream);

const avatarPreset = 'avatar';

export const uploadAvatar = (userId: string, stream: Readable) =>
  uploadFile(`${avatarPreset}_${userId}`, avatarPreset, stream);

const postPreset = 'post_image';

export const uploadPostFile = (
  name: string,
  stream: Readable,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const outStream = cloudinary.v2.uploader.upload_stream(
      {
        public_id: name,
        upload_preset: postPreset,
      },
      (err, callResult) => {
        if (err) {
          return reject(err);
        }

        return resolve(
          cloudinary.v2.url(callResult.public_id, {
            secure: true,
            fetch_format: 'auto',
            quality: 'auto',
            sign_url: true,
          }),
        );
      },
    );
    stream.pipe(outStream);
  });

export const uploadPostImage = (postId: string, stream: Readable) =>
  uploadPostFile(`${postPreset}_${postId}`, stream);
