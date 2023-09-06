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

export enum UploadPreset {
  DevCard = 'devcard',
  Avatar = 'avatar',
  SquadImage = 'squad',
  PostBannerImage = 'post_image',
  FreeformImage = 'freeform_image',
  FreeformGif = 'freeform_gif',
}

interface OptionalProps {
  invalidate?: boolean;
}

interface UploadResult {
  url: string;
  id: string;
}

type UploadFn = (
  name: string,
  stream: Readable,
  options?: OptionalProps,
) => Promise<UploadResult>;

export const uploadFile = (
  name: string,
  preset: UploadPreset,
  stream: Readable,
): Promise<UploadResult> =>
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

        return resolve({
          url: cloudinary.v2.url(callResult.public_id, {
            version: callResult.version,
            secure: true,
            fetch_format: 'auto',
            quality: 'auto',
            sign_url: true,
          }),
          id: callResult.public_id,
        });
      },
    );
    stream.pipe(outStream);
  });

export const uploadDevCardBackground: UploadFn = (name, stream) =>
  uploadFile(name, UploadPreset.DevCard, stream);

export const uploadSquadImage: UploadFn = (name, stream) =>
  uploadFile(name, UploadPreset.SquadImage, stream);

export const uploadAvatar: UploadFn = (userId, stream) =>
  uploadFile(`${UploadPreset.Avatar}_${userId}`, UploadPreset.Avatar, stream);

type PostPreset =
  | UploadPreset.PostBannerImage
  | UploadPreset.FreeformImage
  | UploadPreset.FreeformGif;

export const uploadPostFile = (
  name: string,
  stream: Readable,
  preset: PostPreset,
) => uploadFile(name, preset, stream);
