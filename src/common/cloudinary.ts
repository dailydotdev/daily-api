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

        const successResult = callResult as cloudinary.UploadApiResponse;

        return resolve(
          `https://res.cloudinary.com/daily-now/image/upload/t_logo,f_auto/v1/${successResult.public_id}`,
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
  ProfileCover = 'cover',
  TopReaderBadge = 'top_reader_badge',
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

        const successResult = callResult as cloudinary.UploadApiResponse;

        return resolve({
          url: cloudinary.v2.url(successResult.public_id, {
            version: successResult.version,
            secure: true,
            fetch_format: 'auto',
            sign_url: true,
          }),
          id: successResult.public_id,
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

export const uploadProfileCover: UploadFn = (userId, stream) =>
  uploadFile(
    `${UploadPreset.ProfileCover}_${userId}`,
    UploadPreset.ProfileCover,
    stream,
  );

type PostPreset =
  | UploadPreset.PostBannerImage
  | UploadPreset.FreeformImage
  | UploadPreset.FreeformGif;

export const uploadPostFile = (
  name: string,
  stream: Readable,
  preset: PostPreset,
) => uploadFile(name, preset, stream);

export function mapCloudinaryUrl(url: string): string;
export function mapCloudinaryUrl(url: undefined): undefined;
export function mapCloudinaryUrl(url?: string): string | undefined;
export function mapCloudinaryUrl(url?: string): string | undefined {
  return url?.replace(
    /(?:res\.cloudinary\.com\/daily-now|daily-now-res\.cloudinary\.com)/g,
    'media.daily.dev',
  );
}
