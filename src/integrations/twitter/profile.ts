import { Readable } from 'stream';
import { Code, ConnectError } from '@connectrpc/connect';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetch, type RetryOptions } from '../retry';

const twitterRetryOptions: RetryOptions = {
  retries: 3,
};

export type TwitterUser = {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
};

const getTwitterBearerToken = (): string => {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new ConnectError(
      'twitter bearer token not configured',
      Code.FailedPrecondition,
    );
  }

  return token;
};

export const fetchTwitterProfile = async (
  username: string,
): Promise<TwitterUser> => {
  const response = await retryFetch(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url,name`,
    {
      ...globalFetchOptions,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getTwitterBearerToken()}`,
      },
    },
    twitterRetryOptions,
  );
  const payload = (await response.json()) as {
    data?: TwitterUser;
  };

  if (!payload.data) {
    throw new ConnectError('twitter user not found', Code.NotFound);
  }

  return payload.data;
};

export const downloadTwitterProfileImage = async (
  imageUrl: string,
): Promise<Readable> => {
  const response = await retryFetch(
    imageUrl.replace('_normal', '_400x400'),
    {
      ...globalFetchOptions,
      method: 'GET',
    },
    twitterRetryOptions,
  );

  if (!response.body) {
    throw new ConnectError('failed to download image', Code.Internal);
  }

  return response.body as Readable;
};
