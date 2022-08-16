import cloudinary from 'cloudinary';
import { Readable } from 'stream';

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

const avatarPreset = 'avatar';

export const uploadAvatar = (name: string, stream: Readable) =>
  uploadFile(`${avatarPreset}_${name}`, avatarPreset, stream);
