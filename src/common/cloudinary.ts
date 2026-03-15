import cloudinary from 'cloudinary';
import { Readable } from 'stream';

const sourceLogoWidth = 256;

export enum UploadPreset {
  DevCard = 'devcard',
  Avatar = 'avatar',
  SquadImage = 'squad',
  SquadHeaderImage = 'squad_header',
  Source = 'source',
  PostBannerImage = 'post_image',
  FreeformImage = 'freeform_image',
  FreeformGif = 'freeform_gif',
  ProfileCover = 'cover',
  TopReaderBadge = 'top_reader_badge',
  Organization = 'organization',
  ToolIcon = 'tool_icon',
  WorkspacePhoto = 'workspace_photo',
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

const buildSourceLogoUrl = ({
  publicId,
  version,
  format,
}: {
  publicId: string;
  version?: number;
  format?: string;
}): string =>
  mapCloudinaryUrl(
    cloudinary.v2.url(publicId, {
      version,
      secure: true,
      sign_url: true,
      ...(format === 'svg'
        ? {
            transformation: [
              {
                crop: 'limit',
                width: sourceLogoWidth,
                format: 'png',
              },
              {
                fetch_format: 'auto',
                quality: 'auto',
              },
            ],
          }
        : {
            fetch_format: 'auto',
            quality: 'auto',
          }),
    }),
  ) || '';

const toUploadResult = (
  successResult: cloudinary.UploadApiResponse,
): UploadResult => ({
  url: buildSourceLogoUrl({
    publicId: successResult.public_id,
    version: successResult.version,
    format: successResult.format,
  }),
  id: successResult.public_id,
});

export const uploadLogo = (name: string, stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const outStream = cloudinary.v2.uploader.upload_stream(
      {
        public_id: name,
        upload_preset: UploadPreset.Source,
      },
      (err, callResult) => {
        if (err) {
          return reject(err);
        }

        const successResult = callResult as cloudinary.UploadApiResponse;

        return resolve(toUploadResult(successResult).url);
      },
    );
    stream.pipe(outStream);
  });

export const uploadLogoFromUrl = async (
  name: string,
  url: string,
): Promise<string> => {
  const result = await cloudinary.v2.uploader.upload(url, {
    public_id: name,
    upload_preset: UploadPreset.Source,
  });

  return buildSourceLogoUrl({
    publicId: result.public_id,
    version: result.version,
    format: result.format,
  });
};

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
          url: mapCloudinaryUrl(
            cloudinary.v2.url(successResult.public_id, {
              version: successResult.version,
              secure: true,
              fetch_format: 'auto',
              sign_url: true,
            }),
          ),
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

export const uploadSquadHeaderImage: UploadFn = (name, stream) =>
  uploadFile(name, UploadPreset.SquadHeaderImage, stream);

export const uploadOrganizationImage: UploadFn = (name, stream) =>
  uploadFile(name, UploadPreset.Organization, stream);

export const uploadAvatar: UploadFn = (userId, stream) =>
  uploadFile(`${UploadPreset.Avatar}_${userId}`, UploadPreset.Avatar, stream);

export const uploadProfileCover: UploadFn = (userId, stream) =>
  uploadFile(
    `${UploadPreset.ProfileCover}_${userId}`,
    UploadPreset.ProfileCover,
    stream,
  );

export const uploadToolIcon: UploadFn = (toolId, stream) =>
  uploadFile(
    `${UploadPreset.ToolIcon}_${toolId}`,
    UploadPreset.ToolIcon,
    stream,
  );

type PostPreset =
  | UploadPreset.PostBannerImage
  | UploadPreset.FreeformImage
  | UploadPreset.FreeformGif;

interface ClearFileProps {
  referenceId: string;
  preset: UploadPreset;
}

export const clearFile = ({ referenceId, preset }: ClearFileProps) => {
  if (!process.env.CLOUDINARY_URL) {
    return;
  }

  const id = `${preset}_${referenceId}`;

  return cloudinary.v2.uploader.destroy(id);
};

export const uploadPostFile = (
  name: string,
  stream: Readable,
  preset: PostPreset,
) => uploadFile(name, preset, stream);

export function mapCloudinaryUrl(url: string): string;
export function mapCloudinaryUrl(url: undefined): undefined;
export function mapCloudinaryUrl(url?: string | null): string | undefined;
export function mapCloudinaryUrl(url?: string | null): string | undefined {
  return url?.replace(
    /(?:res\.cloudinary\.com\/daily-now|daily-now-res\.cloudinary\.com)/g,
    'media.daily.dev',
  );
}
